import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { PROJECT_EXPLANATION_PROMPT_VERSION, PROJECT_EXPLANATION_SYSTEM_PROMPT, createPresentationSchema, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto, AnalysisRunState, AnalysisRunStatusDto } from './contracts'
import { createAnalysisWorkspace, createProjectAnalysisWorkspace, changedFiles, fileManifest, removeAnalysisWorkspace } from './analysisWorkspace'
import { detectCodex, parseCodexJson, redact, runCodex } from './codex'
import { quarantineProjectControls } from './projectControls'
import { localProject, prepareLocalFiles } from '../project-sources/localFolderImport'

type Project = { id: string; name: string; framework: string; files: { path: string; content: string }[] }
type Run = { runId: string; projectId: string; agentId: 'codex'; model?: string; codexVersion?: string; state: AnalysisRunState; createdAt: string; startedAt?: string; childPid?: number; child?: ChildProcess; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; cancellationRequested: boolean; terminalOutcome?: 'completed' | 'cancelled' | 'failed'; events: AnalysisEventDto[]; controller: AbortController; project?: Project; source?: 'local' }
const runs = new Map<string, Run>()
const cache = new Map<string, PresentationKnowledgeBase>()
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
  const files = ['src/main.tsx', 'src/App.tsx', 'src/components/AppHeader.tsx', 'src/pages/LoginPage.tsx', 'src/components/LoginForm.tsx', 'src/services/authService.ts', 'src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx', 'src/utils/formatDate.ts']
  return { id: 'prepared-vite-sample', name: 'Prepared Vite sample', framework: 'react-vite' as const, files: await Promise.all(files.map(async (file) => ({ path: file, content: await readFile(path.join(sampleRoot, file), 'utf8') }))) }
}

function cacheKey(project: Project, version: string) { return JSON.stringify({ project: project.id, source: project.files.map((file) => file.path), agent: 'codex', version, prompt: PROJECT_EXPLANATION_PROMPT_VERSION }) }
function prompt(requestFile: string) { return `${PROJECT_EXPLANATION_SYSTEM_PROMPT}\n\nRead ${requestFile} in the current workspace. Return exactly one JSON PresentationKnowledgeBase. Do not write, edit, or create files. Do not use markdown fences.` }

async function execute(run: Run) {
  const project = run.project ?? await sampleProject()
  setState(run, 'preparing-project'); event(run, { type: 'preparing-evidence', message: 'Inspecting the project structure.' })
  const codex = await detectCodex()
  if (!('executable' in codex)) throw Object.assign(new Error(codex.error), { code: 'codex-unavailable' })
  if (!codex.signedIn) throw Object.assign(new Error('Sign in to Codex before analysing a project.'), { code: 'codex-sign-in-required' })
  run.codexVersion = codex.version
  const key = cacheKey(project, codex.version)
  const cached = cache.get(key)
  if (cached) { run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', result: cached, message: 'Opened the generated workspace.' }); return }
  const analysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (stage, state) => { if (state === 'running') event(run, { type: 'analysing', message: `Checking ${stage}.` }) }, 0)
  const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, run.source ? 'Local folder' : 'Prepared sample')
  const workspace = run.source ? await createProjectAnalysisWorkspace(project.files) : await createAnalysisWorkspace(sampleRoot)
  const evidenceDirectory = await mkdtemp(path.join(tmpdir(), 'project-lens-evidence-')); const schemaDirectory = await mkdtemp(path.join(tmpdir(), 'project-lens-schema-')); const schemaPath = path.join(schemaDirectory, 'presentation-schema.json'); const outputPath = path.join(schemaDirectory, 'final-output.json'); await writeFile(schemaPath, JSON.stringify(createPresentationSchema()), 'utf8')
  try {
    const quarantinedControls = await quarantineProjectControls(workspace.directory, evidenceDirectory)
    const requestName = '.project-lens-request.json'
    await writeFile(path.join(workspace.directory, requestName), JSON.stringify({ schemaMarker: 'project-lens-request-v1', promptVersion: PROJECT_EXPLANATION_PROMPT_VERSION, rawKnowledge: raw, quarantinedControls }, null, 2), 'utf8')
    const baseline = await fileManifest(workspace.directory)
    setState(run, 'spawning-agent'); event(run, { type: 'starting-agent', message: 'Starting Codex in a disposable read-only workspace.' })
    const result = await runCodex(codex.executable, { cwd: workspace.directory, model: run.model, schemaPath, outputPath, input: prompt(requestName), signal: run.controller.signal, onProcess: (child) => { run.child = child; run.childPid = child.pid; setState(run, 'agent-process-running') }, onEvent: (item) => { setState(run, 'receiving-agent-events'); event(run, { type: 'analysing', message: item.type === 'turn.started' ? 'Codex is analysing the prepared project.' : 'Codex reported progress.' }, true) } })
    run.child = undefined; run.childPid = undefined
    if (changedFiles(baseline, await fileManifest(workspace.directory)).length) throw new Error('Codex changed the disposable workspace. The result was rejected.')
    if (result.code !== 0 || !result.completed) throw Object.assign(new Error(redact(result.stderr) || 'Codex did not complete the analysis.'), { code: 'codex-invocation-failed', exitCode: result.code })
    setState(run, 'validating'); event(run, { type: 'validating', message: 'Validating the generated project guide.' })
    let text = ''; try { text = (await readFile(outputPath, 'utf8')).slice(0, 1_000_000) } catch { /* final output is required below */ } let output: unknown; let issues: string[]
    try { output = parseCodexJson(text); issues = validatePresentationKnowledgeBase(output, raw) } catch { issues = ['presentation: malformed output'] }
    if (issues.length && text.trim()) {
      setState(run, 'repairing'); event(run, { type: 'repairing', message: 'Repairing the returned JSON against the required schema.' })
      const repair = await runCodex(codex.executable, { cwd: workspace.directory, model: run.model, schemaPath, outputPath, input: `Return corrected JSON only. Validation errors: ${issues.join('; ')}. Previous response:\n${text}`, signal: run.controller.signal, onEvent: () => event(run, { type: 'repairing', message: 'Codex is repairing the structured response.' }, true) })
      if (changedFiles(baseline, await fileManifest(workspace.directory)).length) throw new Error('Codex changed the disposable workspace. The result was rejected.')
      if (repair.code !== 0 || !repair.completed) throw Object.assign(new Error(redact(repair.stderr) || 'Codex did not complete the schema repair.'), { code: 'codex-invocation-failed', exitCode: repair.code })
      try { text = (await readFile(outputPath, 'utf8')).slice(0, 1_000_000) } catch { text = '' }
      try { output = parseCodexJson(text); issues = validatePresentationKnowledgeBase(output, raw) } catch { issues = ['presentation: malformed output'] }
    }
    if (issues.length) throw Object.assign(new Error(`Codex output could not be validated: ${issues.join('; ')}`), { code: 'output-invalid' })
    cache.set(key, output as PresentationKnowledgeBase); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', result: output as PresentationKnowledgeBase, message: 'Opened the generated workspace.' })
  } finally { await removeAnalysisWorkspace(workspace.directory, run.source ? (workspace as { source?: string }).source : undefined); await rm(evidenceDirectory, { recursive: true, force: true, maxRetries: 3 }); await rm(schemaDirectory, { recursive: true, force: true, maxRetries: 3 }) }
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
  if (req.method === 'POST' && (url.pathname === '/api/analysis/sample' || url.pathname === '/api/analysis/local')) {
    if (activeRun()) return send(res, 409, { error: 'An analysis is already running.' })
    try {
      const parsed = JSON.parse(await body(req, 2_000_000)) as { name?: string; files?: { path: string; content: string }[]; model?: string }
      const local = url.pathname.endsWith('/local')
      const project = local ? localProject(parsed.name ?? 'Local project', prepareLocalFiles((parsed.files ?? []).map((file) => ({ ...file, size: new TextEncoder().encode(file.content).byteLength }))).files) : undefined
      if (local && !project?.files.length) return send(res, 400, { error: 'No supported project text files were included.' })
      const run: Run = { runId: randomUUID(), projectId: project?.id ?? 'prepared-vite-sample', agentId: 'codex', model: typeof parsed.model === 'string' ? parsed.model : undefined, state: 'queued', createdAt: new Date().toISOString(), cancellationRequested: false, events: [], controller: new AbortController(), project, source: local ? 'local' : undefined }
      runs.set(run.runId, run); event(run, { type: 'queued', message: 'Preparing the project.' }); void execute(run).catch((error) => fail(run, error)); return send(res, 202, { runId: run.runId })
    } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Invalid analysis request.' }) }
  }
  const match = url.pathname.match(/^\/api\/analysis\/([^/]+)(?:\/(events|cancel))?$/)
  if (match) {
    const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'run-not-found' })
    if (!match[2] && req.method === 'GET') return send(res, 200, status(run))
    if (match[2] === 'cancel' && req.method === 'POST') { run.cancellationRequested = true; setState(run, 'cancelling'); event(run, { type: 'analysing', message: 'Cancellation requested.' }); run.controller.abort(); return send(res, 202, { runId: run.runId, status: 'cancelling' }) }
    if (match[2] === 'events' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); let index = 0; const timer = setInterval(() => { while (index < run.events.length) { const current = run.events[index++]; res.write(`event: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) { clearInterval(timer); res.end(); return } } }, 100); req.on('close', () => clearInterval(timer)); return }
  }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
