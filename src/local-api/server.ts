import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { createPresentationFallback, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto, AnalysisRunState, AnalysisRunStatusDto, ProviderAuthSessionDto, ProviderAuthState } from './contracts'
import { createAnalysisWorkspace, createProjectAnalysisWorkspace, changedFiles, fileManifest, removeAnalysisWorkspace } from './analysisWorkspace'
import { localProject, prepareLocalFiles } from '../project-sources/localFolderImport'
import { analysisEnvironment, applyProviderAvailability, buildAnalysisArgs, buildAnalysisCacheKey, buildProjectRequestFile, canStartOpenCodeAnalysis, classifyOpenCodeFailure, detectOpenCode, discoverModels, discoverProviders, extractOpenCodeText, freeModelIds, isSafeAnalysisConfig, launchOpenCodeAuth, openCodeDiagnosticArgs, openCodeFailureMessage, OpenCodeFailureError, OpenCodeTimeoutError, probeOpenCodeCompatibility, probeOpenCodeReadiness, redact, resolveOpenCodeExecutable, runOpenCode, sanitizeResearchMetadata } from './opencode'
import { quarantineProjectControls } from './projectControls'

type RunRecord = { runId: string; projectId: string; agentId: string; modelId: string; openCodeVersion?: string; state: AnalysisRunState; createdAt: string; startedAt?: string; childPid?: number; childProcessHandle?: ChildProcess; workspace?: string; requestFile?: string; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; cancellationRequested: boolean; terminalOutcome?: 'completed' | 'cancelled' | 'failed' | 'interrupted'; events: AnalysisEventDto[]; controller: AbortController; project?: Awaited<ReturnType<typeof sampleProject>>; source?: string }
const runs = new Map<string, RunRecord>()
const authSessions = new Map<string, ProviderAuthSessionDto & { processId?: number; terminalClosed?: boolean }>()
const completedCache = new Map<string, PresentationKnowledgeBase>()
const sampleRoot = path.resolve(process.cwd(), 'prepared-sample-project')
export const daemonToken = process.env.PROJECT_LENS_API_TOKEN ?? randomUUID()
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])
export function isAllowedDaemonRequest(origin: string | undefined, token: string | undefined) { return (!origin || allowedOrigins.has(origin)) && token === daemonToken }

function send(res: import('node:http').ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function event(runId: string, next: AnalysisEventDto, genuine = false) {
  const run = runs.get(runId); if (!run) return
  const timestamp = new Date().toISOString(); run.lastAnyEventAt = timestamp; if (genuine) run.lastGenuineAgentEventAt = timestamp
  run.events.push({ ...next, timestamp })
}
function setRunState(run: RunRecord, state: AnalysisRunState) { run.state = state; if (!run.startedAt && state !== 'queued') run.startedAt = new Date().toISOString() }
function statusOf(run: RunRecord): AnalysisRunStatusDto { const { controller: _controller, childProcessHandle: _child, project: _project, source: _source, workspace: _workspace, requestFile: _requestFile, ...status } = run; return status }
function activeRun() { return [...runs.values()].find((run) => !run.terminalOutcome) }
function createRun(runId: string, projectId: string, modelId: string, events: AnalysisEventDto[], extra: Partial<RunRecord> = {}): RunRecord {
  const now = new Date().toISOString()
  return { runId, projectId, agentId: 'opencode', modelId, state: 'queued', createdAt: now, cancellationRequested: false, events, controller: new AbortController(), ...extra }
}
function analysisFailure(runId: string, modelId: string, error: unknown): AnalysisEventDto {
  const last = runs.get(runId)?.events.at(-1)
  if (error instanceof OpenCodeTimeoutError) {
    const message = error.timeoutType === 'provider-first-response' ? 'The model did not return its first response within 4 minutes.' : `OpenCode timed out during ${error.timeoutType.replaceAll('-', ' ')}.`
    return { type: 'failed', error: message, message: `Stopped after ${last?.message ?? 'starting OpenCode'}.`, diagnostic: { timeoutType: error.timeoutType, stderr: redact(error.message), modelId, lastActivity: last?.timestamp } }
  }
  if (error instanceof Error && error.message.includes('cancelled')) return { type: 'cancelled', error: 'Analysis was cancelled.' }
  const code = classifyOpenCodeFailure(error)
  const message = code === 'opencode-database-busy' ? 'OpenCode startup was attempted, but its local database was locked. No model response was requested or received.' : error instanceof Error ? redact(error.message) : 'Analysis failed.'
  return { type: 'failed', error: code === 'provider-authentication-required' ? 'OpenCode is not connected' : openCodeFailureMessage(code), message, diagnostic: { code, stderr: error instanceof Error ? redact(error.message) : undefined, modelId, lastActivity: last?.timestamp } }
}
function recordFailure(runId: string, modelId: string, error: unknown) {
  const run = runs.get(runId); if (!run || run.terminalOutcome) return
  const cancelled = error instanceof Error && error.message.includes('cancelled')
  run.terminalOutcome = cancelled ? 'cancelled' : 'failed'; setRunState(run, cancelled ? 'cancelled' : 'failed'); event(runId, analysisFailure(runId, modelId, error))
}
function authSession(providerId: string, status: ProviderAuthState, message: string, command?: string): ProviderAuthSessionDto & { processId?: number; terminalClosed?: boolean } {
  const session = { id: randomUUID(), providerId, status, message, startedAt: new Date().toISOString(), command }
  authSessions.set(session.id, session)
  return session
}
async function verifyAuthSession(session: ProviderAuthSessionDto & { processId?: number; terminalClosed?: boolean }) {
  if (['cancelled', 'connected', 'launch-failed', 'verification-failed'].includes(session.status)) return session
  const executable = resolveOpenCodeExecutable()
  if (!executable) { session.status = 'verification-failed'; session.message = 'OpenCode could not be found to verify the connection.'; return session }
  try {
    const providers = await discoverProviders(executable)
    if (providers.some((provider) => provider.id === session.providerId && provider.connected)) { session.status = 'connected'; session.message = 'OpenCode connected. You can now analyse the project.'; return session }
    if (session.terminalClosed) { session.status = 'terminal-closed-before-completion'; session.message = 'The OpenCode window closed before the provider was connected.'; return session }
    if (Date.now() - new Date(session.startedAt).getTime() > 5 * 60_000) { session.status = 'verification-failed'; session.message = 'No provider connection was detected. You can check again or choose another model.'; return session }
    session.status = 'waiting-for-user'; session.message = 'Complete the connection in the OpenCode window.'
  } catch { session.status = 'verification-failed'; session.message = 'Project Lens could not verify the OpenCode connection. Check the connection and try again.' }
  return session
}
async function sampleProject() {
  const files = ['src/main.tsx', 'src/App.tsx', 'src/components/AppHeader.tsx', 'src/pages/LoginPage.tsx', 'src/components/LoginForm.tsx', 'src/services/authService.ts', 'src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx', 'src/utils/formatDate.ts']
  return { id: 'prepared-vite-sample', name: 'Prepared Vite sample', framework: 'react-vite' as const, files: await Promise.all(files.map(async (file) => ({ path: file, content: await readFile(path.join(sampleRoot, file), 'utf8') }))) }
}
export async function analyseLocalProject(input: { name?: string; files?: { path: string; content: string }[] }) {
  if (!input.name || !Array.isArray(input.files) || input.files.length > 300) throw new Error('Invalid local project import.')
  const prepared = prepareLocalFiles(input.files.map((file) => ({ ...file, size: new TextEncoder().encode(file.content).byteLength })))
  if (!prepared.files.length) throw new Error('No supported project text files were included.')
  const workspace = await mkdtemp(path.join(tmpdir(), 'project-lens-local-'))
  try {
    for (const file of prepared.files) { const target = path.join(workspace, file.path); if (!target.startsWith(workspace + path.sep)) throw new Error('Unsafe local path.'); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, file.content, 'utf8') }
    const project = localProject(input.name, prepared.files)
    const analysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, () => {})
    return { knowledge: createPresentationFallback(createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Local folder')), included: prepared.files.length, skipped: prepared.skipped, size: prepared.size }
  } finally { await rm(workspace, { recursive: true, force: true, maxRetries: 3 }) }
}

async function runAnalysis(runId: string, modelId: string, variant?: string, webResearchEnabled = true) {
  const active = runs.get(runId)!; const project = active.project ?? await sampleProject(); setRunState(active, 'preparing-project'); event(runId, { type: 'preparing-evidence', message: 'Preparing a safe evidence package.' })
  const key = buildAnalysisCacheKey(project, 'opencode', modelId, variant)
  const cached = completedCache.get(key)
  if (cached) { active.terminalOutcome = 'completed'; setRunState(active, 'completed'); event(runId, { type: 'completed', result: cached }); return }
  const analysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (stage, status) => { if (status === 'running') event(runId, { type: 'analysing', message: `Running deterministic ${stage} analysis.` }) }, 0)
  const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, active.source ? 'Local folder' : 'Sample')
  const executable = resolveOpenCodeExecutable(); if (!executable) throw new OpenCodeFailureError('process-startup-failure', 'OpenCode is unavailable.')
  if (!isSafeAnalysisConfig()) throw new OpenCodeFailureError('permission-or-configuration-failure', 'OpenCode runtime safety could not be confirmed. Analysis was not started.')
  const compatibility = await probeOpenCodeCompatibility(executable, active.controller.signal); active.openCodeVersion = compatibility.version; event(runId, { type: 'preparing-evidence', message: `OpenCode ${compatibility.version} compatibility confirmed.` }); event(runId, { type: 'preparing-evidence', message: 'Checking OpenCode local readiness before any model request.' }); const readiness = await probeOpenCodeReadiness(executable, active.controller.signal, undefined, (attempt, delay) => event(runId, { type: 'preparing-evidence', message: `OpenCode database is busy; checking again in ${delay / 1_000}s (attempt ${attempt + 1}).` })); event(runId, { type: 'preparing-evidence', message: `OpenCode readiness confirmed in ${readiness.elapsedMs}ms.` }); const availableModels = applyProviderAvailability(readiness.models, readiness.providers)
  const selectedModel = availableModels.find((model) => model.fullId === modelId)
  if (!selectedModel) throw new OpenCodeFailureError('model-unavailable', 'The selected model is not in the current OpenCode catalogue.')
  if (selectedModel.availability === 'requires-provider' || selectedModel.runnable === false) throw new OpenCodeFailureError('provider-authentication-required', 'Connect OpenCode to use this model.')
  if (!canStartOpenCodeAnalysis(selectedModel)) throw new OpenCodeFailureError('permission-or-configuration-failure', 'Provider readiness could not be confirmed. Analysis was not started.')
  const workspace = active.source ? await createProjectAnalysisWorkspace(project.files) : await createAnalysisWorkspace(sampleRoot); active.workspace = workspace.directory
  const requestDirectory = await mkdtemp(path.join(tmpdir(), 'project-lens-request-'))
  const runtimeConfigDirectory = await mkdtemp(path.join(tmpdir(), 'project-lens-opencode-config-'))
  try {
    const quarantinedControls = await quarantineProjectControls(workspace.directory, requestDirectory)
    await writeFile(path.join(runtimeConfigDirectory, 'opencode.json'), analysisEnvironment({}, webResearchEnabled).OPENCODE_CONFIG_CONTENT ?? '{}', 'utf8')
    setRunState(active, 'spawning-agent'); event(runId, { type: 'starting-agent', message: 'Starting OpenCode in the disposable workspace.' })
    const requestFile = path.join(requestDirectory, '.project-lens-request.json')
    await writeFile(requestFile, buildProjectRequestFile(raw, webResearchEnabled, quarantinedControls), 'utf8'); active.requestFile = requestFile; event(runId, { type: 'preparing-evidence', message: 'Created the bounded Project Lens request file.' })
    let integrityBaseline = await fileManifest(workspace.directory)
    const baseArgs = buildAnalysisArgs(modelId, workspace.directory, requestFile, variant)
    if (compatibility.supportsPure) baseArgs.splice(1, 0, '--pure')
    const args = [...openCodeDiagnosticArgs(process.env.PROJECT_LENS_OPENCODE_DIAGNOSTICS === '1'), ...baseArgs]
    let webResearchOutcome: 'not-requested' | 'configured' | 'used-successfully' | 'attempted-but-unavailable' | 'failed' = webResearchEnabled ? 'configured' : 'not-requested'
    const options = { cwd: workspace.directory, env: analysisEnvironment(process.env, webResearchEnabled, runtimeConfigDirectory), signal: active.controller.signal,
      onProcessHandle: (child: ChildProcess) => { active.childProcessHandle = child },
      onProcessStarted: (pid: number) => { active.childPid = pid; setRunState(active, 'agent-process-running'); event(runId, { type: 'starting-agent', message: `OpenCode process started (PID ${pid}).` }); setRunState(active, 'waiting-for-provider'); event(runId, { type: 'analysing', message: 'OpenCode is running. Waiting for the selected model to respond…' }) },
      onProcessError: (error: Error) => event(runId, { type: 'failed', error: 'OpenCode could not start locally.', message: `OpenCode process error: ${redact(error.message)}`, diagnostic: { code: 'process-startup-failure', modelId } }),
      onProcessExited: (code: number | null) => { active.childPid = undefined; active.childProcessHandle = undefined; event(runId, { type: 'analysing', message: `OpenCode process exited${code === null ? '' : ` with code ${code}`}.` }) },
      onStdoutEvent: (parsed: Record<string, unknown>) => {
      setRunState(active, 'receiving-agent-events')
      event(runId, { type: 'analysing', message: 'OpenCode emitted a structured event.' }, true)
      if (parsed.type === 'web-research') {
        const outcome = parsed.outcome
        if (outcome === 'used-successfully' || outcome === 'attempted-but-unavailable' || outcome === 'failed') webResearchOutcome = outcome
        const source = parsed.source && typeof parsed.source === 'object' ? parsed.source as { title?: unknown; url?: unknown } : undefined
        event(runId, {
          type: 'analysing',
          message: typeof parsed.message === 'string'
            ? sanitizeResearchMetadata(parsed.message)
            : outcome === 'used-successfully'
              ? 'Web research was used successfully.'
              : outcome === 'attempted-but-unavailable'
                ? 'Web research was attempted but unavailable.'
                : 'Web research failed, so Project Lens continued with project evidence only.',
          diagnostic: {
            webResearchOutcome: webResearchOutcome,
            webResearchSource: source && typeof source.title === 'string' && typeof source.url === 'string'
              ? { title: sanitizeResearchMetadata(source.title), url: sanitizeResearchMetadata(source.url) }
              : undefined,
          },
        })
        return
      }
      event(runId, { type: 'analysing', message: 'OpenCode is receiving a response from the selected model.' })
    } }
    const result = await runOpenCode(executable, args, '', options)
    const mutation = changedFiles(integrityBaseline, await fileManifest(workspace.directory))
    if (mutation.length) throw new Error(`OpenCode changed the disposable sample (${mutation.join(', ')}). Result rejected.`)
    if (result.code !== 0) throw new Error(redact(result.stderr) || 'OpenCode analysis failed.')
    event(runId, { type: 'validating' })
    let presentation: unknown
    try { presentation = JSON.parse(extractOpenCodeText(result.stdout)) } catch { throw new Error('OpenCode did not return structured JSON.') }
    let issues = validatePresentationKnowledgeBase(presentation, raw)
    if (issues.length) {
      const repairFile = path.join(workspace.directory, '.project-lens-repair-request.json')
      await writeFile(repairFile, `${buildProjectRequestFile(raw, webResearchEnabled)}\nRepair these validation errors only: ${issues.join('; ')}\nPrevious output: ${JSON.stringify(presentation)}`, 'utf8')
      integrityBaseline = await fileManifest(workspace.directory)
      const repairArgs = [...openCodeDiagnosticArgs(process.env.PROJECT_LENS_OPENCODE_DIAGNOSTICS === '1'), ...buildAnalysisArgs(modelId, workspace.directory, repairFile, variant)]
      const repair = await runOpenCode(executable, repairArgs, '', options)
      if (changedFiles(integrityBaseline, await fileManifest(workspace.directory)).length) throw new Error('OpenCode changed the disposable sample. Result rejected.')
      try { presentation = JSON.parse(extractOpenCodeText(repair.stdout)) } catch { throw new Error('OpenCode repair did not return structured JSON.') }
      issues = validatePresentationKnowledgeBase(presentation, raw)
    }
    if (issues.length) throw new Error(`OpenCode output could not be validated: ${issues.join('; ')}`)
    const validPresentation = presentation as PresentationKnowledgeBase
    completedCache.set(key, validPresentation)
    active.terminalOutcome = 'completed'; setRunState(active, 'completed'); event(runId, { type: 'completed', result: validPresentation, diagnostic: { webResearchOutcome } })
  } finally { active.workspace = undefined; active.requestFile = undefined; await removeAnalysisWorkspace(workspace.directory, active.source ? (workspace as { source?: string }).source : undefined); await rm(requestDirectory, { recursive: true, force: true, maxRetries: 3 }); await rm(runtimeConfigDirectory, { recursive: true, force: true, maxRetries: 3 }) }
}

export const daemon = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/api/runtime/health') return send(res, 200, { status: 'ready', version: '0.1.0', token: daemonToken })
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: 'origin-not-allowed' })
  if (!isAllowedDaemonRequest(origin, req.headers['x-project-lens-token'] as string | undefined) && url.searchParams.get('token') !== daemonToken) return send(res, 401, { error: 'invalid-daemon-token' })
  if (req.method === 'GET' && url.pathname === '/api/opencode/readiness') { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: 'process-startup-failure', message: detected.error }); try { const readiness = await probeOpenCodeReadiness(detected.executablePath); return send(res, 200, { ready: true, attempts: readiness.attempts, elapsedMs: readiness.elapsedMs }) } catch (error) { const code = classifyOpenCodeFailure(error); return send(res, 409, { ready: false, error: code, message: openCodeFailureMessage(code) }) } }
  if (req.method === 'GET' && url.pathname === '/api/agents') return send(res, 200, [await detectOpenCode()])
  if (req.method === 'GET' && url.pathname === '/api/agents/opencode/models') { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { const providers = await discoverProviders(detected.executablePath); return send(res, 200, applyProviderAvailability(await discoverModels(detected.executablePath), providers)) } catch (error) { return send(res, 502, { error: error instanceof Error ? error.message : 'Model discovery failed.' }) } }
  if (req.method === 'GET' && url.pathname === '/api/agents/opencode/free-models') { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { return send(res, 200, freeModelIds(await discoverModels(detected.executablePath))) } catch (error) { return send(res, 502, { error: error instanceof Error ? error.message : 'Model discovery failed.' }) } }
  if (req.method === 'GET' && (url.pathname === '/api/opencode/models' || url.pathname === '/api/opencode/providers')) { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { const providers = await discoverProviders(detected.executablePath); return send(res, 200, url.pathname.endsWith('/models') ? applyProviderAvailability(await discoverModels(detected.executablePath), providers) : providers) } catch (error) { return send(res, 502, { error: error instanceof Error ? redact(error instanceof Error ? error.message : String(error)) : 'OpenCode discovery failed.' }) } }
  if (req.method === 'POST' && url.pathname === '/api/analysis/local') { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) return send(res, 413, { error: 'Import is too large.' }) } try { const parsed = JSON.parse(body) as { projectId?: string; name?: string; files?: { path: string; content: string }[]; modelId?: string; webResearchEnabled?: boolean }; if (!parsed.projectId?.startsWith('local-') || !parsed.modelId) return send(res, 400, { error: 'A local project ID and model are required.' }); const prepared = prepareLocalFiles((parsed.files ?? []).map((file) => ({ ...file, size: new TextEncoder().encode(file.content).byteLength }))); if (!prepared.files.length) return send(res, 400, { error: 'No supported project text files were included.' }); const project = localProject(parsed.name ?? 'Local project', prepared.files); const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); const available = applyProviderAvailability(await discoverModels(detected.executablePath), await discoverProviders(detected.executablePath)); if (!available.some((model) => model.fullId === parsed.modelId && model.availability === 'ready')) return send(res, 409, { error: 'The selected provider is not connected. Connect it in OpenCode, then refresh models.' }); if (activeRun()) return send(res, 409, { error: 'An analysis is already running.' }); const runId = randomUUID(); runs.set(runId, createRun(runId, project.id, parsed.modelId, [{ type: 'queued', message: `Reading ${prepared.files.length} project files.` }], { project, source: 'local' })); void runAnalysis(runId, parsed.modelId, undefined, parsed.webResearchEnabled ?? true).catch((error) => recordFailure(runId, parsed.modelId!, error)); return send(res, 202, { runId, projectId: project.id, included: prepared.files.length, skipped: prepared.skipped, size: prepared.size }) } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Local project import failed.' }) } }
  if (req.method === 'POST' && url.pathname === '/api/projects/local') { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) return send(res, 413, { error: 'Import is too large.' }) } try { return send(res, 200, await analyseLocalProject(JSON.parse(body))) } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Local project import failed.' }) } }
  const authMatch = url.pathname.match(/^\/api\/opencode\/auth-sessions\/([^/]+)$/)
  if (authMatch) {
    const session = authSessions.get(authMatch[1]); if (!session) return send(res, 404, { error: 'Unknown authentication session.' })
    if (req.method === 'GET') return send(res, 200, await verifyAuthSession(session))
    if (req.method === 'POST') { session.status = 'cancelled'; session.message = 'Connection check cancelled. OpenCode was not changed.'; return send(res, 200, session) }
  }
  if (req.method === 'POST' && (url.pathname === '/api/opencode/providers/connect' || url.pathname === '/api/opencode/providers/disconnect')) {
    let body = ''; for await (const chunk of req) body += chunk; let parsed: { providerId?: string }; try { parsed = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid request body.' }) }
    const executable = resolveOpenCodeExecutable(); if (!executable || !parsed.providerId || !/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(parsed.providerId)) return send(res, 400, { error: 'Invalid provider.' })
    const providers = await discoverProviders(executable); if (!providers.some((provider) => provider.id === parsed.providerId)) return send(res, 404, { error: 'Provider is not in OpenCode’s discovered catalogue.' })
    if (url.pathname.endsWith('/connect')) {
      const existing = [...authSessions.values()].find((session) => session.providerId === parsed.providerId && ['launching', 'waiting-for-user'].includes(session.status))
      if (existing) return send(res, 200, existing)
      const session = authSession(parsed.providerId, 'launching', 'Launching the OpenCode connection window.')
      try {
        const launch = launchOpenCodeAuth(executable, parsed.providerId, () => { const current = authSessions.get(session.id); if (current && current.status === 'waiting-for-user') current.terminalClosed = true }, () => { const current = authSessions.get(session.id); if (current) { current.status = 'launch-failed'; current.message = 'OpenCode authentication could not start. Use the connection instructions instead.' } })
        session.processId = launch.pid; session.command = launch.command; session.status = 'waiting-for-user'; session.message = 'Complete the connection in the OpenCode window.'
        return send(res, 202, session)
      } catch (error) { session.status = 'launch-failed'; session.message = 'OpenCode authentication could not start. Use the connection instructions instead.'; return send(res, 502, { ...session, error: redact(error instanceof Error ? error.message : 'OpenCode authentication could not start.') }) }
    }
    const result = await runOpenCode(executable, ['auth', 'logout', parsed.providerId], '', { timeoutMs: 15_000 }); if (result.code !== 0) return send(res, 502, { error: redact(result.stderr) || 'Provider disconnect failed.' }); return send(res, 200, { status: 'disconnected' })
  }
  if (req.method === 'POST' && url.pathname === '/api/analysis/sample') { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 5_000) return send(res, 413, { error: 'Request is too large.' }) } let parsed: { agentId?: string; modelId?: string; variant?: string; webResearchEnabled?: boolean }; try { parsed = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid request body.' }) } if (parsed.agentId !== 'opencode' || !parsed.modelId || parsed.modelId.includes('..') || parsed.modelId.length > 240 || (parsed.variant !== undefined && (typeof parsed.variant !== 'string' || parsed.variant.length > 80))) return send(res, 400, { error: 'Only an OpenCode model for the prepared sample is allowed.' }); if (activeRun()) return send(res, 409, { error: 'One sample analysis is already running.' }); const runId = randomUUID(); runs.set(runId, createRun(runId, 'prepared-vite-sample', parsed.modelId, [{ type: 'queued' }])); void runAnalysis(runId, parsed.modelId, parsed.variant, parsed.webResearchEnabled ?? true).catch((error) => recordFailure(runId, parsed.modelId!, error)); return send(res, 202, { runId }) }
  const match = url.pathname.match(/^\/api\/analysis\/([^/]+)\/(events|cancel)$/)
  const statusMatch = url.pathname.match(/^\/api\/analysis\/([^/]+)$/)
  if (statusMatch && req.method === 'GET') { const run = runs.get(statusMatch[1]); return run ? send(res, 200, statusOf(run)) : send(res, 404, { error: 'run-not-found', message: 'The analysis session was interrupted because the local service restarted.' }) }
  if (match) {
    const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'run-not-found', message: 'The analysis session was interrupted because the local service restarted.' })
    if (req.method === 'POST' && match[2] === 'cancel') {
      if (run.terminalOutcome) return send(res, 200, { status: run.terminalOutcome, runId: run.runId })
      if (!run.cancellationRequested) { run.cancellationRequested = true; setRunState(run, 'cancelling'); event(run.runId, { type: 'analysing', message: 'Cancellation requested. Stopping the owned OpenCode process.' }); run.controller.abort() }
      return send(res, 202, { status: 'cancelling', runId: run.runId })
    }
    if (req.method === 'GET' && match[2] === 'events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); let index = 0
      const timer = setInterval(() => { while (index < run.events.length) { const current = run.events[index++]; res.write(`event: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) { clearInterval(timer); res.end() } } }, 100)
      req.on('close', () => clearInterval(timer)); return
    }
  }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
