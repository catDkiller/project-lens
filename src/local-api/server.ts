import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runProjectAnalysis } from '../analysis'
import { PROJECT_EXPLANATION_PROMPT_VERSION, buildPresentationKnowledgeBase, createCodexEvidencePrompt, createProjectKnowledgeBase, parseCodexInsights, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto, AnalysisRunState, AnalysisRunStatusDto } from './contracts'
import { changedFiles, fileManifest } from './analysisWorkspace'
import { detectCodex, parseCodexJson, redact } from './codex'
import { runCodexSdk } from './codexSdkRunner'
import { acceptsLocalPath, classifyLocalPath, localProject, prepareLocalFiles, type LocalSkipReason } from '../project-sources/localFolderImport'
import { assessLocalProject } from '../project-sources/support'
import { createHash } from 'node:crypto'

type Project = { id: string; name: string; framework: string; files: { path: string; content: string }[] }
type Run = { runId: string; projectId: string; agentId: 'codex'; model?: string; codexVersion?: string; state: AnalysisRunState; createdAt: string; startedAt?: string; childPid?: number; child?: ChildProcess; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; cancellationRequested: boolean; terminalOutcome?: 'completed' | 'cancelled' | 'failed'; events: AnalysisEventDto[]; controller: AbortController; project?: Project; source?: 'local' }
const runs = new Map<string, Run>()
const baseCache = new Map<string, PresentationKnowledgeBase>()
const enrichmentCache = new Map<string, PresentationKnowledgeBase>()
const sampleRoot = path.resolve(process.cwd(), 'prepared-sample-project')
export const daemonToken = process.env.PROJECT_LENS_API_TOKEN ?? randomUUID()
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])

export function isAllowedDaemonRequest(origin: string | undefined, token: string | undefined) { return (!origin || allowedOrigins.has(origin)) && token === daemonToken }
function send(res: import('node:http').ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function setState(run: Run, state: AnalysisRunState) { run.state = state; if (!run.startedAt && state !== 'queued') run.startedAt = new Date().toISOString() }
function event(run: Run, next: AnalysisEventDto, genuine = false) { const timestamp = new Date().toISOString(); run.lastAnyEventAt = timestamp; if (genuine) run.lastGenuineAgentEventAt = timestamp; run.events.push({ ...next, timestamp }) }
function status(run: Run): AnalysisRunStatusDto { const { controller: _controller, child: _child, project: _project, source: _source, ...result } = run; return result }
function activeRun() { return [...runs.values()].find((run) => !run.terminalOutcome) }

async function sampleProject() {
  const files: { path: string; content: string }[] = []
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name); const relative = path.relative(sampleRoot, absolute).replaceAll('\\', '/')
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile()) { try { files.push({ path: relative, content: await readFile(absolute, 'utf8') }) } catch { /* skip unreadable fixture files */ } }
    }
  }
  await visit(sampleRoot)
  return { id: 'prepared-sample', name: 'Prepared sample', framework: 'Software project', files: files.sort((left, right) => left.path.localeCompare(right.path)) }
}

function baseCacheKey(project: Project, fingerprint: string) { return JSON.stringify({ project: project.id, fingerprint, source: project.files.map((file) => file.path), analyser: 'deterministic-v1' }) }
function enrichmentCacheKey(project: Project, version: string, fingerprint: string) { return JSON.stringify({ project: project.id, fingerprint, agent: 'codex', version, prompt: PROJECT_EXPLANATION_PROMPT_VERSION }) }
function projectFingerprint(project: Project) { const hash = createHash('sha256'); for (const file of [...project.files].sort((left, right) => left.path.localeCompare(right.path))) hash.update(`\0${file.path}\0${file.content}`); return hash.digest('hex') }
async function readLocalFolder(folder: string) {
  const root = await realpath(folder); const info = await stat(root)
  if (!info.isDirectory() || root === path.parse(root).root) throw new Error('Choose an existing project folder, not a drive root.')
  const candidates: { path: string; content: string; size: number }[] = []; const skippedByReason: Record<LocalSkipReason, number> = { 'dependency-generated': 0, sensitive: 0, 'binary-unsupported': 0, oversized: 0, unsafe: 0 }
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name); const relative = path.relative(root, absolute).replaceAll('\\', '/')
      if (entry.isDirectory()) { if (classifyLocalPath(`${relative}/placeholder.txt`, 0) === 'dependency-generated') { skippedByReason['dependency-generated']++; continue } await visit(absolute) }
      else if (entry.isFile()) { const size = (await stat(absolute)).size; const reason = classifyLocalPath(relative, size); if (reason) { skippedByReason[reason]++; continue }; if (!acceptsLocalPath(relative, size)) { skippedByReason.unsafe++; continue }; candidates.push({ path: relative, content: await readFile(absolute, 'utf8'), size }) }
    }
  }
  await visit(root)
  const prepared = prepareLocalFiles(candidates); const assessment = assessLocalProject(prepared.files)
  return { name: path.basename(root), files: prepared.files, summary: `${prepared.files.length} relevant files`, projectType: assessment.projectType, skipped: Object.fromEntries(Object.keys(skippedByReason).map((key) => [key, skippedByReason[key as LocalSkipReason] + prepared.skippedByReason[key as LocalSkipReason]])) as Record<LocalSkipReason, number>, support: prepared.files.length ? assessment.support : 'failed' as const, diagnostics: assessment.evidence }
}
async function execute(run: Run) {
  const project = run.project ?? await sampleProject()
  setState(run, 'preparing-project'); event(run, { type: 'preparing-evidence', message: 'Inspecting the project structure.' })
  const analysis = await runProjectAnalysis(project, [], (stage, state) => { if (state === 'running') event(run, { type: 'preparing-evidence', message: `Checking ${stage}.` }) }, 0)
  const raw = createProjectKnowledgeBase(analysis, [], run.source ? 'Selected folder' : 'Prepared sample')
  const fingerprint = projectFingerprint(project)
  const baseKey = baseCacheKey(project, fingerprint)
  const base = baseCache.get(baseKey) ?? buildPresentationKnowledgeBase(raw)
  const baseIssues = validatePresentationKnowledgeBase(base, raw)
  if (baseIssues.length || base.projectName !== project.name || base.sourceFingerprint !== raw.sourceFingerprint || base.files?.some((file) => !raw.importantFiles?.some((known) => known.path === file.path))) throw Object.assign(new Error(`Local analysis could not be validated: ${baseIssues.join('; ')}`), { code: 'output-invalid' })
  baseCache.set(baseKey, base)
  setState(run, 'workspace-ready'); event(run, { type: 'workspace-ready', result: base, message: 'Opened the local project workspace.' })
  if (!run.model) { run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', message: 'Local analysis is complete.' }); return }
  const codex = await detectCodex()
  if (!('executable' in codex) || !codex.signedIn) {
    setState(run, 'enrichment-unavailable'); event(run, { type: 'enrichment-unavailable', message: 'AI explanations could not be added. Local project analysis is available.' }); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', message: 'Local analysis is complete.' }); return
  }
  run.codexVersion = codex.version
  const enrichmentKey = enrichmentCacheKey(project, codex.version, fingerprint)
  const cached = enrichmentCache.get(enrichmentKey)
  if (cached) { setState(run, 'enrichment-complete'); event(run, { type: 'enriched', result: cached, message: 'Added verified AI explanations.' }); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', message: 'Local analysis is complete.' }); return }
  const workspace = await mkdtemp(path.join(tmpdir(), 'project-lens-codex-'))
  try {
    const baseline = await fileManifest(workspace)
    setState(run, 'enriching-with-codex'); event(run, { type: 'enriching', message: 'Adding optional Codex explanations.' })
    const result = await runCodexSdk({ executable: codex.executable, workingDirectory: workspace, model: undefined, prompt: createCodexEvidencePrompt(raw), signal: run.controller.signal })
    event(run, { type: 'enriching', message: 'Codex returned the project explanation.' }, true)
    if (changedFiles(baseline, await fileManifest(workspace)).length) throw new Error('Codex changed the disposable workspace. The result was rejected.')
    let text = result.finalResponse.slice(0, 1_000_000); let insights: import('../knowledge').CodexInsightResponse | undefined; let issues: string[]
    try { const parsed = parseCodexInsights(parseCodexJson(text), raw); insights = parsed.insights; issues = parsed.issues } catch { issues = ['insight: malformed output'] }
    const output = buildPresentationKnowledgeBase(raw, insights)
    const presentationIssues = validatePresentationKnowledgeBase(output, raw)
    if (issues.length || presentationIssues.length) throw Object.assign(new Error(`Codex output could not be validated: ${[...issues, ...presentationIssues].join('; ')}`), { code: 'output-invalid' })
    if (output.projectName !== project.name || output.sourceFingerprint !== raw.sourceFingerprint || output.files?.some((file) => !raw.importantFiles?.some((known) => known.path === file.path))) throw Object.assign(new Error('Generated workspace does not match the selected folder.'), { code: 'source-mismatch' })
    enrichmentCache.set(enrichmentKey, output); setState(run, 'enrichment-complete'); event(run, { type: 'enriched', result: output, message: 'Added verified AI explanations.' })
  } catch {
    setState(run, 'enrichment-unavailable'); event(run, { type: 'enrichment-unavailable', message: 'AI explanations could not be added. Local project analysis is available.' })
  } finally { await rm(workspace, { recursive: true, force: true, maxRetries: 3 }); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', message: 'Local analysis is complete.' }) }
}

function fail(run: Run, error: unknown) { if (run.terminalOutcome) return; const cancelled = error instanceof Error && /cancelled/i.test(error.message); const detail = error as { code?: AnalysisEventDto['diagnostic'] extends { code?: infer Code } ? Code : never; exitCode?: number }; run.terminalOutcome = cancelled ? 'cancelled' : 'failed'; setState(run, cancelled ? 'cancelled' : 'failed'); event(run, { type: cancelled ? 'cancelled' : 'failed', error: cancelled ? 'Analysis was cancelled.' : error instanceof Error ? error.message : 'Analysis failed.', diagnostic: { code: detail?.code ?? 'unknown', exitCode: detail?.exitCode, stderr: error instanceof Error ? redact(error.message) : undefined, codexVersion: run.codexVersion } }) }
async function body(req: import('node:http').IncomingMessage, limit: number) { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > limit) throw new Error('Request is too large.') } return value }

export const daemon = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/api/runtime/health') return send(res, 200, { status: 'ready', version: '0.1.0', token: daemonToken })
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: 'origin-not-allowed' })
  if (!isAllowedDaemonRequest(origin, req.headers['x-project-lens-token'] as string | undefined) && url.searchParams.get('token') !== daemonToken) return send(res, 401, { error: 'invalid-daemon-token' })
  if (req.method === 'GET' && url.pathname === '/api/codex/status') { const result = await detectCodex(); return 'executable' in result ? send(res, 200, { status: result.signedIn ? 'ready' : 'sign-in-required', version: result.version }) : send(res, 503, { status: 'unavailable', error: result.error }) }
  if (req.method === 'POST' && url.pathname === '/api/source/local-path') {
    try { const parsed = JSON.parse(await body(req, 20_000)) as { path?: string }; if (typeof parsed.path !== 'string' || !parsed.path.trim()) return send(res, 400, { error: 'Enter a local project folder path.' }); return send(res, 200, await readLocalFolder(parsed.path.trim())) } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'The folder could not be prepared locally.' }) }
  }
  if (req.method === 'POST' && (url.pathname === '/api/analysis/sample' || url.pathname === '/api/analysis/local')) {
    if (activeRun()) return send(res, 409, { error: 'An analysis is already running.' })
    try {
      const parsed = JSON.parse(await body(req, 14_000_000)) as { name?: string; projectType?: string; files?: { path: string; content: string }[]; model?: string; enrich?: boolean }
      const local = url.pathname.endsWith('/local')
      const project = local ? localProject(parsed.name ?? 'Local project', prepareLocalFiles((parsed.files ?? []).map((file) => ({ ...file, size: new TextEncoder().encode(file.content).byteLength }))).files, parsed.projectType ?? 'Software project') : undefined
      if (local && !project?.files.length) return send(res, 400, { error: 'No supported project text files were included.' })
      const run: Run = { runId: randomUUID(), projectId: project?.id ?? 'prepared-vite-sample', agentId: 'codex', model: parsed.enrich ? 'automatic' : undefined, state: 'queued', createdAt: new Date().toISOString(), cancellationRequested: false, events: [], controller: new AbortController(), project, source: local ? 'local' : undefined }
      runs.set(run.runId, run); event(run, { type: 'queued', message: 'Preparing the project.' }); void execute(run).catch((error) => fail(run, error)); return send(res, 202, { runId: run.runId })
    } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Invalid analysis request.' }) }
  }
  const match = url.pathname.match(/^\/api\/analysis\/([^/]+)(?:\/(events|cancel))?$/)
  if (match) {
    const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'run-not-found' })
    if (!match[2] && req.method === 'GET') return send(res, 200, status(run))
    if (match[2] === 'cancel' && req.method === 'POST') { run.cancellationRequested = true; setState(run, 'cancelling'); event(run, { type: 'preparing-evidence', message: 'Cancellation requested.' }); run.controller.abort(); return send(res, 202, { runId: run.runId, status: 'cancelling' }) }
    if (match[2] === 'events' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); let index = 0; const timer = setInterval(() => { while (index < run.events.length) { const current = run.events[index++]; res.write(`event: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) { clearInterval(timer); res.end(); return } } }, 100); req.on('close', () => clearInterval(timer)); return }
  }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
