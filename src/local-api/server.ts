import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { appendFile, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { runProjectAnalysis } from '../analysis'
import { buildReportFromValidatedArtifacts, createProjectKnowledgeBase, REPORT_BUILDER_VERSION, REPORT_SCHEMA_VERSION, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto, AnalysisRunState, AnalysisRunStatusDto } from './contracts'
import { redact } from './codex'
import { buildCodexArgs, readRequiredArtifacts, resolveCodexCli, runCodexCli, stageRun } from './codexCli'
import { acceptsLocalPath, classifyLocalPath, localProject, prepareLocalFiles, type LocalSkipReason } from '../project-sources/localFolderImport'
import { assessLocalProject } from '../project-sources/support'
import { ARTIFACT_VALIDATOR_VERSION, PERSISTED_RUN_SCHEMA_VERSION, PROJECT_LENS_API_VERSION } from '../runtimeVersion'

type Project = { id: string; name: string; framework: string; files: { path: string; content: string }[] }
type Run = { runId: string; projectId: string; agentId: 'codex'; model?: string; codexVersion?: string; state: AnalysisRunState; createdAt: string; startedAt?: string; workerScheduledAt?: string; workerStartedAt?: string; firstStageEventAt?: string; discoveryStartedAt?: string; childPid?: number; child?: ChildProcess; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; cancellationRequested: boolean; terminalOutcome?: 'completed' | 'cancelled' | 'failed'; events: AnalysisEventDto[]; controller: AbortController; project?: Project; source?: 'local'; sourcePath?: string; runDirectory?: string; report?: PresentationKnowledgeBase }
const runs = new Map<string, Run>()
const sampleRoot = path.resolve(process.cwd(), 'prepared-sample-project')
export const daemonToken = process.env.PROJECT_LENS_API_TOKEN ?? randomUUID()
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])
const daemonStartedAt = new Date().toISOString()
const gitCommit = process.env.PROJECT_LENS_GIT_COMMIT ?? (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim() } catch { return 'unknown' } })()
const daemonBuildId = process.env.PROJECT_LENS_BUILD_ID ?? `api-${gitCommit}-${PROJECT_LENS_API_VERSION}-${REPORT_SCHEMA_VERSION}`

export function isAllowedDaemonRequest(origin: string | undefined, token: string | undefined) { return (!origin || allowedOrigins.has(origin)) && token === daemonToken }
function send(res: import('node:http').ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function setState(run: Run, state: AnalysisRunState) { run.state = state; if (!run.startedAt && state !== 'queued') run.startedAt = new Date().toISOString() }
function event(run: Run, next: AnalysisEventDto, genuine = false) { const timestamp = new Date().toISOString(); run.lastAnyEventAt = timestamp; if (!run.firstStageEventAt && next.stage) run.firstStageEventAt = timestamp; if (next.stage === 'discovery' && next.status === 'active' && !run.discoveryStartedAt) run.discoveryStartedAt = timestamp; if (genuine) run.lastGenuineAgentEventAt = timestamp; run.events.push({ ...next, id: next.id ?? randomUUID(), runId: run.runId, sequence: run.events.length + 1, timestamp }) }
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
async function projectFromSnapshot(directory: string, name: string) {
  const files: Project['files'] = []
  async function visit(current: string) { for (const entry of await readdir(current, { withFileTypes: true })) { const absolute = path.join(current, entry.name); if (entry.isDirectory()) await visit(absolute); else if (entry.isFile()) { try { files.push({ path: path.relative(directory, absolute).replaceAll('\\', '/'), content: await readFile(absolute, 'utf8') }) } catch { /* text-only snapshot */ } } } }
  await visit(directory); return { id: `recovered-${name}`, name, framework: 'Software project', files: files.sort((left, right) => left.path.localeCompare(right.path)) }
}
async function recoverRun(runId: string) {
  const directory = path.join(process.cwd(), '.project-lens', 'runs', runId); const metadata = JSON.parse(await readFile(path.join(directory, 'run.json'), 'utf8')) as { projectName?: string; codex?: { model?: string; version?: string }; error?: string; schemaVersion?: number }; const { error: _oldError, schemaVersion: _oldVersion, ...recoveredMetadata } = metadata; const project = await projectFromSnapshot(path.join(directory, 'source'), metadata.projectName ?? 'Recovered project'); const raw = createProjectKnowledgeBase(await runProjectAnalysis(project, [], () => undefined, 0), [], 'Selected folder'); const artifacts = await readRequiredArtifacts(path.join(directory, 'artifacts'), new Set(project.files.map((file) => file.path))); const output = buildReportFromValidatedArtifacts(raw, { overview: artifacts['overview.md'], completeGuide: artifacts['complete-guide.md'] }); const issues = validatePresentationKnowledgeBase(output, raw); if (issues.length) throw Object.assign(new Error(issues.join('; ')), { code: 'report-rebuild-invalid' }); await writeReport(directory, output); const run: Run = { runId, projectId: project.id, agentId: 'codex', model: metadata.codex?.model === 'automatic' ? undefined : metadata.codex?.model, codexVersion: metadata.codex?.version, state: 'completed', createdAt: new Date().toISOString(), cancellationRequested: false, terminalOutcome: 'completed', events: [], controller: new AbortController(), project, runDirectory: directory, report: output }; runs.set(runId, run); event(run, { type: 'artifact_ready', result: output, message: 'Existing analysis artifacts validated.' }); event(run, { type: 'completed', message: 'Analysis complete.' }); await writeRunMetadata(directory, { ...recoveredMetadata, error: undefined, state: 'completed', artifactState: 'validated', terminalResult: 'completed', reportSchemaVersion: REPORT_SCHEMA_VERSION, reportBuilderVersion: REPORT_BUILDER_VERSION }); return run
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
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
async function stagedSourceHash(source: string, files: Project['files']) { const snapshot = await Promise.all(files.map(async (file) => ({ path: file.path, content: await readFile(path.join(source, ...file.path.split('/')), 'utf8') }))); return sourceHash(snapshot) }
async function writeRunMetadata(directory: string, values: Record<string, unknown>) {
  const target = path.join(directory, 'run.json'); const temporary = `${target}.${randomUUID()}.tmp`
  let existing: Record<string, unknown> = {}; try { existing = JSON.parse(await readFile(target, 'utf8')) as Record<string, unknown> } catch { /* initial write */ }
  const merged: Record<string, unknown> = { ...existing, ...values, schemaVersion: PERSISTED_RUN_SCHEMA_VERSION }; Object.keys(merged).forEach((key) => { if (merged[key] === undefined) delete merged[key] })
  await writeFile(temporary, JSON.stringify(merged, null, 2), 'utf8'); await rename(temporary, target)
}
async function writeReport(directory: string, report: PresentationKnowledgeBase) {
  const target = path.join(directory, 'report.json'); const temporary = `${target}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify({ schemaVersion: REPORT_SCHEMA_VERSION, reportBuilderVersion: REPORT_BUILDER_VERSION, report }, null, 2), 'utf8'); await rename(temporary, target)
}
async function execute(run: Run) {
  setState(run, 'preparing-project'); event(run, { type: 'preparing-evidence', stage: 'preparing', status: 'active', message: 'Preparing local analysis.' }); await new Promise<void>((resolve) => setTimeout(resolve, 0)); if (run.controller.signal.aborted) throw new Error('Analysis was cancelled.')
  const project = run.project ?? await sampleProject()
  event(run, { type: 'preparing-evidence', stage: 'preparing', status: 'complete', message: 'Preparing complete.' }); await new Promise<void>((resolve) => setTimeout(resolve, 0)); if (run.controller.signal.aborted) throw new Error('Analysis was cancelled.')
  event(run, { type: 'preparing-evidence', stage: 'discovery', status: 'active', message: 'Discovering project files.' }); await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const analysis = await runProjectAnalysis(project, [], (stage, state) => { if (state === 'running' && stage !== 'inventory') event(run, { type: 'preparing-evidence', stage: 'filtering', status: 'active', message: stage === 'imports' ? 'Selecting relevant files.' : `Building ${stage}.`, metadata: { discoveredFiles: project.files.length } }) }, 0, { signal: run.controller.signal, onProgress: (stage, detail) => { if (stage === 'inventory') event(run, { type: 'preparing-evidence', stage: 'discovery', status: 'active', message: `${detail.current.toLocaleString()} files discovered${detail.area ? ` · ${detail.area}/` : ''}`, progress: { current: detail.current, total: detail.total, unit: 'files' }, metadata: { discoveredFiles: detail.current } }); else event(run, { type: 'preparing-evidence', stage: 'filtering', status: 'active', message: `${detail.current.toLocaleString()} of ${detail.total.toLocaleString()} files evaluated.`, progress: { current: detail.current, total: detail.total, unit: 'files', percentage: detail.total ? Math.round(detail.current / detail.total * 100) : undefined }, metadata: { discoveredFiles: project.files.length } }) } })
  event(run, { type: 'preparing-evidence', stage: 'discovery', status: 'complete', message: `Project scan complete · ${analysis.inventory.files.length} files discovered.`, progress: { current: analysis.inventory.files.length, total: Math.max(project.files.length, analysis.inventory.files.length), unit: 'files', percentage: 100 }, metadata: { discoveredFiles: analysis.inventory.files.length, includedFiles: analysis.inventory.files.length } })
  event(run, { type: 'preparing-evidence', stage: 'filtering', status: 'complete', message: `Analysis scope selected · ${analysis.inventory.files.length} readable files.`, progress: { current: analysis.inventory.files.length, total: analysis.inventory.files.length, unit: 'files', percentage: 100 }, metadata: { discoveredFiles: analysis.inventory.files.length, includedFiles: analysis.inventory.files.length } })
  const raw = createProjectKnowledgeBase(analysis, [], run.source ? 'Selected folder' : 'Prepared sample')
  const codex = await resolveCodexCli()
  if (!('executable' in codex)) throw Object.assign(new Error(codex.error), { code: 'codex-unavailable' })
  if (!codex.signedIn) throw Object.assign(new Error('Sign in to Codex before analysing a project.'), { code: 'codex-sign-in-required' })
  run.codexVersion = codex.version
  const skill = await readFile(path.join(process.cwd(), 'skills', 'project-analysis', 'SKILL.md'), 'utf8')
  event(run, { type: 'preparing-evidence', stage: 'snapshot', status: 'active', message: 'Creating local analysis snapshot.' })
  let lastSnapshotUpdate = 0
  const staged = await stageRun(process.cwd(), run.runId, project.files, skill, (file) => { const now = Date.now(); if (file.index === file.total || file.index === 1 || file.index % 25 === 0 || now - lastSnapshotUpdate >= 200) { lastSnapshotUpdate = now; event(run, { type: 'preparing-evidence', stage: 'snapshot', status: 'active', message: `Copied ${file.index.toLocaleString()} of ${file.total.toLocaleString()} files.`, progress: { current: file.index, total: file.total, unit: 'files', percentage: file.total ? Math.round(file.index / file.total * 100) : 100 }, file: { projectRelativePath: file.path, action: 'copied' }, metadata: { includedFiles: file.total, processedBytes: file.bytes } }) } })
  run.runDirectory = staged.directory
  const totalBytes = project.files.reduce((total, file) => total + Buffer.byteLength(file.content), 0)
  event(run, { type: 'preparing-evidence', stage: 'snapshot', status: 'complete', message: `Snapshot ready · ${project.files.length} files · ${formatBytes(totalBytes)}.`, progress: { current: totalBytes, total: totalBytes, unit: 'bytes', percentage: 100 }, metadata: { includedFiles: project.files.length, processedBytes: totalBytes } })
  event(run, { type: 'preparing-evidence', stage: 'codex-preparation', status: 'complete', message: 'Project Lens instructions and manifest staged.' })
  const metadata: Record<string, unknown> = { runId: run.runId, selectedFolder: run.sourcePath ?? 'prepared sample', projectName: project.name, sourceFingerprint: raw.sourceFingerprint, sourceSnapshotHash: sourceHash(project.files), includedFileCount: project.files.length, skippedFileCount: 0, includedByteCount: project.files.reduce((total, file) => total + Buffer.byteLength(file.content), 0), detectedLanguages: raw.detectedLanguages, startedAt: run.createdAt, codex: { executable: codex.executable, version: codex.version, model: run.model ?? 'automatic' }, state: 'running', artifactState: 'pending' }
  await writeRunMetadata(staged.directory, metadata)
  try {
    setState(run, 'running'); event(run, { type: 'run_started', stage: 'codex-analysis', status: 'active', message: `Starting Codex${run.model ? ` · ${run.model}` : ''}.`, metadata: { includedFiles: project.files.length, processedBytes: totalBytes, selectedModel: run.model } })
    const eventsPath = path.join(staged.directory, 'events.jsonl')
    const child = runCodexCli({ executable: codex.executable, args: buildCodexArgs(staged.directory, run.model), cwd: staged.directory, prompt: 'Read skill/SKILL.md, inspect source/, and write artifacts/overview.md and artifacts/complete-guide.md. Finish only after verifying the artifacts.', signal: run.controller.signal, onProcess: (process) => { run.child = process; run.childPid = process.pid; event(run, { type: 'status', stage: 'codex-analysis', status: 'active', message: 'Codex process started.', process: { alive: true, pidAvailable: Boolean(process.pid) }, metadata: { selectedModel: run.model } }) }, onEvent: (received) => { if (received.threadId) metadata.codexThreadId = received.threadId; const message = received.message?.slice(0, 500); void appendFile(eventsPath, `${JSON.stringify({ ...received, raw: undefined })}\n`, 'utf8'); const types: Record<string, AnalysisEventDto['type']> = { thread_started: 'thread_started', status: 'status', tool_call: 'tool_call', tool_result: 'tool_result', file_write: 'file_write', warning: 'warning' }; const mapped = types[received.type] ?? 'status'; const fileMatch = message?.match(/(?:source[\\/])?([\w./-]+\.(?:py|ts|tsx|js|json|md|txt|yml))/i); event(run, { type: mapped, stage: 'codex-analysis', status: received.type === 'warning' ? 'warning' : 'active', message: message || received.type, file: fileMatch ? { projectRelativePath: fileMatch[1].replace(/^source[\\/]/, ''), action: received.type === 'tool_call' ? 'inspected' : 'written' } : undefined, process: { alive: true, pidAvailable: Boolean(run.childPid) }, metadata: { selectedModel: run.model } }, received.type === 'tool_call' || received.type === 'tool_result' || received.type === 'file_write') } })
    const result = await child
    event(run, { type: 'status', stage: 'codex-analysis', status: result.code === 0 ? 'complete' : 'failed', message: result.code === 0 ? 'Codex completed generation.' : 'Codex process exited unexpectedly.', process: { alive: false, pidAvailable: Boolean(run.childPid), exitCode: result.code }, metadata: { selectedModel: run.model } }, false)
    run.childPid = undefined
    run.child = undefined
    if (run.cancellationRequested) throw Object.assign(new Error('Analysis was cancelled.'), { code: 'analysis-aborted', exitCode: result.code })
    if (result.code !== 0) throw Object.assign(new Error(`Codex exited with code ${result.code}.`), { code: 'codex-invocation-failed', exitCode: result.code, stderr: result.stderr })
    if (await stagedSourceHash(staged.source, project.files) !== metadata.sourceSnapshotHash) throw Object.assign(new Error('Codex modified the protected source snapshot.'), { code: 'source-mismatch' })
    event(run, { type: 'preparing-evidence', stage: 'validation', status: 'active', message: 'Validating generated artifacts.' })
    const artifacts = await readRequiredArtifacts(staged.artifacts, new Set(project.files.map((file) => file.path)))
    const output = buildReportFromValidatedArtifacts(raw, { overview: artifacts['overview.md'], completeGuide: artifacts['complete-guide.md'] })
    const presentationIssues = validatePresentationKnowledgeBase(output, raw)
    if (presentationIssues.length) throw Object.assign(new Error(`Analysis artifacts could not be validated: ${presentationIssues.join('; ')}`), { code: 'output-invalid' })
    if (output.projectName !== project.name || output.sourceFingerprint !== raw.sourceFingerprint || output.files?.some((file) => !raw.importantFiles?.some((known) => known.path === file.path))) throw Object.assign(new Error('Generated workspace does not match the selected folder.'), { code: 'source-mismatch' })
    event(run, { type: 'preparing-evidence', stage: 'validation', status: 'complete', message: 'Generated artifacts passed validation.', progress: { current: 2, total: 2, unit: 'checks', percentage: 100 }, metadata: { artifactName: 'overview.md' } })
    run.report = output; await writeReport(staged.directory, output); metadata.state = 'artifact-ready'; metadata.artifactState = 'validated'; metadata.terminalResult = 'completed'; setState(run, 'artifact-ready'); event(run, { type: 'artifact_ready', stage: 'opening-report', status: 'active', result: output, message: 'Artifacts ready · opening the report.' }); run.terminalOutcome = 'completed'; setState(run, 'completed'); event(run, { type: 'completed', stage: 'opening-report', status: 'complete', message: 'Analysis complete.' })
  } finally { metadata.state = run.state; metadata.terminalResult = run.terminalOutcome; await writeRunMetadata(staged.directory, metadata) }
}

async function fail(run: Run, error: unknown) {
  if (run.terminalOutcome) return
  const cancelled = error instanceof Error && /cancelled/i.test(error.message)
  const detail = error as { code?: AnalysisEventDto['diagnostic'] extends { code?: infer Code } ? Code : never; exitCode?: number }
  run.terminalOutcome = cancelled ? 'cancelled' : 'failed'
  setState(run, cancelled ? 'cancelled' : 'failed')
  const stage = run.events.findLast((item) => item.stage)?.stage
  event(run, {
    type: cancelled ? 'cancelled' : 'failed',
    stage,
    status: cancelled ? 'cancelled' : 'failed',
    error: cancelled ? 'Analysis was cancelled.' : error instanceof Error ? error.message : 'Analysis failed.',
    diagnostic: { code: detail?.code ?? 'unknown', exitCode: detail?.exitCode, stderr: error instanceof Error ? redact(error.message) : undefined, codexVersion: run.codexVersion, lastActivity: run.lastGenuineAgentEventAt },
  })
  if (run.runDirectory) await writeRunMetadata(run.runDirectory, { runId: run.runId, state: run.state, terminalResult: run.terminalOutcome, error: error instanceof Error ? redact(error.message) : 'Analysis failed.' })
}
async function body(req: import('node:http').IncomingMessage, limit: number) { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > limit) throw new Error('Request is too large.') } return value }

export const daemon = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/api/runtime/health') return send(res, 200, { status: 'ready', version: '0.1.0', token: daemonToken })
  if (req.method === 'GET' && url.pathname === '/api/meta') return send(res, 200, { app: 'project-lens', buildId: daemonBuildId, gitCommit, daemonStartedAt, processId: process.pid, apiVersion: PROJECT_LENS_API_VERSION, persistedRunSchemaVersion: PERSISTED_RUN_SCHEMA_VERSION, reportSchemaVersion: REPORT_SCHEMA_VERSION, artifactValidatorVersion: ARTIFACT_VALIDATOR_VERSION })
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: 'origin-not-allowed' })
  if (!isAllowedDaemonRequest(origin, req.headers['x-project-lens-token'] as string | undefined) && url.searchParams.get('token') !== daemonToken) return send(res, 401, { error: 'invalid-daemon-token' })
  if (req.method === 'GET' && url.pathname === '/api/codex/status') { const result = await resolveCodexCli(); return 'executable' in result ? send(res, 200, { status: result.signedIn ? 'ready' : 'sign-in-required', version: result.version, models: result.models }) : send(res, 503, { status: 'unavailable', error: result.error }) }
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
      run.workerScheduledAt = new Date().toISOString(); runs.set(run.runId, run); event(run, { type: 'queued', stage: 'preparing', status: 'pending', message: 'Run created.' }); event(run, { type: 'status', stage: 'preparing', status: 'active', message: 'Selected project accepted.' }); void (async () => { run.workerStartedAt = new Date().toISOString(); event(run, { type: 'status', stage: 'preparing', status: 'active', message: 'Local analysis worker started.' }); await execute(run) })().catch(async (error) => { await fail(run, error) }); return send(res, 202, { runId: run.runId })
    } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Invalid analysis request.' }) }
  }
  const recoverMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/recheck$/)
  if (recoverMatch && req.method === 'POST') { try { const run = await recoverRun(recoverMatch[1]); return send(res, 200, { runId: run.runId, report: run.report }) } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Artifacts could not be rechecked.' }) } }
  const match = url.pathname.match(/^\/api\/(?:analysis|runs)\/([^/]+)(?:\/(events|cancel|report|files))?$/)
  if (match) {
    const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'run-not-found' })
    if (!match[2] && req.method === 'GET') return send(res, 200, status(run))
    if (match[2] === 'report' && req.method === 'GET') return run.report ? send(res, 200, run.report) : send(res, 409, { error: 'report-not-ready' })
    if (match[2] === 'files' && req.method === 'GET') return send(res, 200, { files: run.project?.files.map((file) => file.path) ?? [] })
    if (match[2] === 'cancel' && req.method === 'POST') { if (run.terminalOutcome) return send(res, 409, { error: 'run-already-finished' }); run.cancellationRequested = true; setState(run, 'cancelling'); event(run, { type: 'preparing-evidence', stage: run.events.findLast((item) => item.stage)?.stage, status: 'active', message: 'Cancellation requested.' }); run.controller.abort(); return send(res, 202, { runId: run.runId, status: 'cancelling' }) }
    if (match[2] === 'events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no', connection: 'keep-alive' })
      const lastEventId = Number(req.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? 0); let index = Number.isInteger(lastEventId) && lastEventId >= 0 ? lastEventId : 0
      let closed = false; const close = () => { if (!closed) { closed = true; clearInterval(timer); res.end() } }
      const timer = setInterval(() => { if (closed) return; if (index === run.events.length) res.write(': keepalive\n\n'); while (index < run.events.length) { const current = run.events[index++]; res.write(`id: ${index}\nevent: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) return close() } }, 500)
      req.on('close', close); req.on('aborted', close); return
    }
  }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
