import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { appendFile, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { runProjectAnalysis } from '../analysis'
import { buildPresentationKnowledgeBase, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto, AnalysisRunState, AnalysisRunStatusDto } from './contracts'
import { redact } from './codex'
import { buildCodexArgs, readRequiredArtifacts, resolveCodexCli, runCodexCli, stageRun } from './codexCli'
import { acceptsLocalPath, classifyLocalPath, localProject, prepareLocalFiles, type LocalSkipReason } from '../project-sources/localFolderImport'
import { assessLocalProject } from '../project-sources/support'

type Project = { id: string; name: string; framework: string; files: { path: string; content: string }[] }
type Run = { runId: string; projectId: string; agentId: 'codex'; model?: string; codexVersion?: string; state: AnalysisRunState; createdAt: string; startedAt?: string; childPid?: number; child?: ChildProcess; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; cancellationRequested: boolean; terminalOutcome?: 'completed' | 'cancelled' | 'failed'; events: AnalysisEventDto[]; controller: AbortController; project?: Project; source?: 'local'; sourcePath?: string; runDirectory?: string; report?: PresentationKnowledgeBase }
const runs = new Map<string, Run>()
const sampleRoot = path.resolve(process.cwd(), 'prepared-sample-project')
export const daemonToken = process.env.PROJECT_LENS_API_TOKEN ?? randomUUID()
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])

export function isAllowedDaemonRequest(origin: string | undefined, token: string | undefined) { return (!origin || allowedOrigins.has(origin)) && token === daemonToken }
function send(res: import('node:http').ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function setState(run: Run, state: AnalysisRunState) { run.state = state; if (!run.startedAt && state !== 'queued') run.startedAt = new Date().toISOString() }
function event(run: Run, next: AnalysisEventDto, genuine = false) { const timestamp = new Date().toISOString(); run.lastAnyEventAt = timestamp; if (genuine) run.lastGenuineAgentEventAt = timestamp; run.events.push({ ...next, timestamp }) }
function status(run: Run): AnalysisRunStatusDto { const { controller: _controller, child: _child, project: _project, source: _source, sourcePath: _sourcePath, runDirectory: _runDirectory, report: _report, ...result } = run; return result }
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
  return { name: path.basename(root), canonicalPath: root, files: prepared.files, summary: `${prepared.files.length} relevant files`, projectType: assessment.projectType, skipped: Object.fromEntries(Object.keys(skippedByReason).map((key) => [key, skippedByReason[key as LocalSkipReason] + prepared.skippedByReason[key as LocalSkipReason]])) as Record<LocalSkipReason, number>, support: prepared.files.length ? assessment.support : 'failed' as const, diagnostics: assessment.evidence }
}
function sourceHash(files: Project['files']) { return createHash('sha256').update(files.map((file) => `${file.path}\0${file.content}\0`).join('')).digest('hex') }
async function stagedSourceHash(source: string, files: Project['files']) { const snapshot = await Promise.all(files.map(async (file) => ({ path: file.path, content: await readFile(path.join(source, ...file.path.split('/')), 'utf8') }))); return sourceHash(snapshot) }
async function writeRunMetadata(directory: string, values: Record<string, unknown>) { await writeFile(path.join(directory, 'run.json'), JSON.stringify(values, null, 2), 'utf8') }
async function execute(run: Run) {
  const project = run.project ?? await sampleProject()
  setState(run, 'preparing-project'); event(run, { type: 'preparing-evidence', message: 'Inspecting the project structure.' })
  const analysis = await runProjectAnalysis(project, [], (stage, state) => { if (state === 'running') event(run, { type: 'preparing-evidence', message: `Checking ${stage}.` }) }, 0)
  const raw = createProjectKnowledgeBase(analysis, [], run.source ? 'Selected folder' : 'Prepared sample')
  const codex = await resolveCodexCli()
  if (!('executable' in codex)) throw Object.assign(new Error(codex.error), { code: 'codex-unavailable' })
  if (!codex.signedIn) throw Object.assign(new Error('Sign in to Codex before analysing a project.'), { code: 'codex-sign-in-required' })
  run.codexVersion = codex.version
  const skill = await readFile(path.join(process.cwd(), 'skills', 'project-analysis', 'SKILL.md'), 'utf8')
  const staged = await stageRun(process.cwd(), run.runId, project.files, skill)
  run.runDirectory = staged.directory
  const metadata: Record<string, unknown> = { runId: run.runId, selectedFolder: run.sourcePath ?? 'prepared sample', projectName: project.name, sourceFingerprint: raw.sourceFingerprint, sourceSnapshotHash: sourceHash(project.files), includedFileCount: project.files.length, skippedFileCount: 0, includedByteCount: project.files.reduce((total, file) => total + Buffer.byteLength(file.content), 0), detectedLanguages: raw.detectedLanguages, startedAt: run.createdAt, codex: { executable: codex.executable, version: codex.version, model: run.model ?? 'automatic' }, state: 'running', artifactState: 'pending' }
  await writeRunMetadata(staged.directory, metadata)
  try {
    setState(run, 'running'); event(run, { type: 'run_started', message: 'Starting Codex in the isolated run workspace.' })
    const eventsPath = path.join(staged.directory, 'events.jsonl')
    const child = runCodexCli({ executable: codex.executable, args: buildCodexArgs(staged.directory, run.model), cwd: staged.directory, prompt: 'Read skill/SKILL.md, inspect source/, and write artifacts/overview.md and artifacts/complete-guide.md. Finish only after verifying the artifacts.', signal: run.controller.signal, onEvent: (received) => { if (received.threadId) metadata.codexThreadId = received.threadId; const message = received.message?.slice(0, 500); void appendFile(eventsPath, `${JSON.stringify({ ...received, raw: undefined })}\n`, 'utf8'); const types: Record<string, AnalysisEventDto['type']> = { thread_started: 'thread_started', status: 'status', tool_call: 'tool_call', tool_result: 'tool_result', file_write: 'file_write', warning: 'warning' }; event(run, { type: types[received.type] ?? 'status', message: message || received.type }, received.type === 'tool_call' || received.type === 'tool_result' || received.type === 'file_write') } })
    const result = await child
    if (run.cancellationRequested) throw Object.assign(new Error('Analysis was cancelled.'), { code: 'analysis-aborted', exitCode: result.code })
    if (result.code !== 0) throw Object.assign(new Error(`Codex exited with code ${result.code}.`), { code: 'codex-invocation-failed', exitCode: result.code, stderr: result.stderr })
    if (await stagedSourceHash(staged.source, project.files) !== metadata.sourceSnapshotHash) throw Object.assign(new Error('Codex modified the protected source snapshot.'), { code: 'source-mismatch' })
    const artifacts = await readRequiredArtifacts(staged.artifacts, new Set(project.files.map((file) => file.path)))
    const baseOutput = buildPresentationKnowledgeBase(raw)
    const output: PresentationKnowledgeBase = { ...baseOutput, overviewMarkdown: artifacts['overview.md'], completeGuideMarkdown: artifacts['complete-guide.md'], shortSummary: artifacts['overview.md'].slice(0, 500), overview: { ...baseOutput.overview, whatItIs: artifacts['overview.md'].slice(0, 2_000) }, sections: [{ id: 'complete-guide-artifact', title: 'Complete Guide', shortExplanation: artifacts['complete-guide.md'].slice(0, 8_000) }, ...(baseOutput.sections ?? [])] }
    const presentationIssues = validatePresentationKnowledgeBase(output, raw)
    if (presentationIssues.length) throw Object.assign(new Error(`Analysis artifacts could not be validated: ${presentationIssues.join('; ')}`), { code: 'output-invalid' })
    if (output.projectName !== project.name || output.sourceFingerprint !== raw.sourceFingerprint || output.files?.some((file) => !raw.importantFiles?.some((known) => known.path === file.path))) throw Object.assign(new Error('Generated workspace does not match the selected folder.'), { code: 'source-mismatch' })
    run.report = output; metadata.state = 'artifact-ready'; metadata.artifactState = 'validated'; metadata.terminalResult = 'completed'; setState(run, 'artifact-ready'); event(run, { type: 'artifact_ready', result: output, message: 'Analysis artifacts validated.' }); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', message: 'Analysis complete.' })
  } finally { metadata.state = run.state; metadata.terminalResult = run.terminalOutcome; await writeRunMetadata(staged.directory, metadata) }
}

function fail(run: Run, error: unknown) { if (run.terminalOutcome) return; const cancelled = error instanceof Error && /cancelled/i.test(error.message); const detail = error as { code?: AnalysisEventDto['diagnostic'] extends { code?: infer Code } ? Code : never; exitCode?: number }; run.terminalOutcome = cancelled ? 'cancelled' : 'failed'; setState(run, cancelled ? 'cancelled' : 'failed'); event(run, { type: cancelled ? 'cancelled' : 'failed', error: cancelled ? 'Analysis was cancelled.' : error instanceof Error ? error.message : 'Analysis failed.', diagnostic: { code: detail?.code ?? 'unknown', exitCode: detail?.exitCode, stderr: error instanceof Error ? redact(error.message) : undefined, codexVersion: run.codexVersion } }) }
async function body(req: import('node:http').IncomingMessage, limit: number) { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > limit) throw new Error('Request is too large.') } return value }

export const daemon = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/api/runtime/health') return send(res, 200, { status: 'ready', version: '0.1.0', token: daemonToken })
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: 'origin-not-allowed' })
  if (!isAllowedDaemonRequest(origin, req.headers['x-project-lens-token'] as string | undefined) && url.searchParams.get('token') !== daemonToken) return send(res, 401, { error: 'invalid-daemon-token' })
  if (req.method === 'GET' && url.pathname === '/api/codex/status') { const result = await resolveCodexCli(); return 'executable' in result ? send(res, 200, { status: result.signedIn ? 'ready' : 'sign-in-required', version: result.version }) : send(res, 503, { status: 'unavailable', error: result.error }) }
  if (req.method === 'POST' && url.pathname === '/api/source/local-path') {
    try { const parsed = JSON.parse(await body(req, 20_000)) as { path?: string }; if (typeof parsed.path !== 'string' || !parsed.path.trim()) return send(res, 400, { error: 'Enter a local project folder path.' }); return send(res, 200, await readLocalFolder(parsed.path.trim())) } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'The folder could not be prepared locally.' }) }
  }
  if (req.method === 'POST' && (url.pathname === '/api/analysis/sample' || url.pathname === '/api/analysis/local' || url.pathname === '/api/runs')) {
    if (activeRun()) return send(res, 409, { error: 'An analysis is already running.' })
    try {
      const parsed = JSON.parse(await body(req, 14_000_000)) as { name?: string; projectType?: string; files?: { path: string; content: string }[]; model?: string; sourcePath?: string }
      const local = url.pathname.endsWith('/local') || (url.pathname === '/api/runs' && Array.isArray(parsed.files))
      const project = local ? localProject(parsed.name ?? 'Local project', prepareLocalFiles((parsed.files ?? []).map((file) => ({ ...file, size: new TextEncoder().encode(file.content).byteLength }))).files, parsed.projectType ?? 'Software project') : undefined
      if (local && !project?.files.length) return send(res, 400, { error: 'No supported project text files were included.' })
      const run: Run = { runId: randomUUID(), projectId: project?.id ?? 'prepared-vite-sample', agentId: 'codex', model: typeof parsed.model === 'string' ? parsed.model : undefined, state: 'queued', createdAt: new Date().toISOString(), cancellationRequested: false, events: [], controller: new AbortController(), project, source: local ? 'local' : undefined, sourcePath: local && typeof parsed.sourcePath === 'string' ? parsed.sourcePath : undefined }
      runs.set(run.runId, run); event(run, { type: 'queued', message: 'Preparing the project.' }); void execute(run).catch((error) => fail(run, error)); return send(res, 202, { runId: run.runId })
    } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Invalid analysis request.' }) }
  }
  const match = url.pathname.match(/^\/api\/(?:analysis|runs)\/([^/]+)(?:\/(events|cancel|report|files))?$/)
  if (match) {
    const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'run-not-found' })
    if (!match[2] && req.method === 'GET') return send(res, 200, status(run))
    if (match[2] === 'report' && req.method === 'GET') return run.report ? send(res, 200, run.report) : send(res, 409, { error: 'report-not-ready' })
    if (match[2] === 'files' && req.method === 'GET') return send(res, 200, { files: run.project?.files.map((file) => file.path) ?? [] })
    if (match[2] === 'cancel' && req.method === 'POST') { run.cancellationRequested = true; setState(run, 'cancelling'); event(run, { type: 'preparing-evidence', message: 'Cancellation requested.' }); run.controller.abort(); return send(res, 202, { runId: run.runId, status: 'cancelling' }) }
    if (match[2] === 'events' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no', connection: 'keep-alive' }); let index = 0; const timer = setInterval(() => { if (index === run.events.length) res.write(': keepalive\n\n'); while (index < run.events.length) { const current = run.events[index++]; res.write(`event: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) { clearInterval(timer); res.end(); return } } }, 1000); req.on('close', () => clearInterval(timer)); return }
  }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
