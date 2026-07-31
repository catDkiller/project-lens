import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { runProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { createProjectExplanationRequest, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { AnalysisEventDto } from './contracts'
import { createAnalysisWorkspace, changedFiles, fileManifest, removeAnalysisWorkspace } from './analysisWorkspace'
import { analysisEnvironment, detectOpenCode, discoverModels, discoverProviders, extractOpenCodeText, freeModelIds, isSafeAnalysisConfig, redact, resolveOpenCodeExecutable, runOpenCode } from './opencode'

const runs = new Map<string, { events: AnalysisEventDto[]; controller: AbortController }>()
const completedCache = new Map<string, PresentationKnowledgeBase>()
const sampleRoot = path.resolve(process.cwd(), 'prepared-sample-project')
const DETERMINISTIC_ANALYSIS_VERSION = '1'

function send(res: import('node:http').ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function event(runId: string, next: AnalysisEventDto) { runs.get(runId)?.events.push(next) }
async function sampleProject() {
  const files = ['src/main.tsx', 'src/App.tsx', 'src/components/AppHeader.tsx', 'src/pages/LoginPage.tsx', 'src/components/LoginForm.tsx', 'src/services/authService.ts', 'src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx', 'src/utils/formatDate.ts']
  return { id: 'prepared-vite-sample', name: 'Prepared Vite sample', framework: 'react-vite' as const, files: await Promise.all(files.map(async (file) => ({ path: file, content: await readFile(path.join(sampleRoot, file), 'utf8') }))) }
}
function cacheKey(project: Awaited<ReturnType<typeof sampleProject>>, modelId: string, variant?: string) {
  return createHash('sha256').update(JSON.stringify({ files: project.files, modelId, variant, DETERMINISTIC_ANALYSIS_VERSION, prompt: 'project-explanation-v1' })).digest('hex')
}
function evidencePrompt(raw: ReturnType<typeof createProjectKnowledgeBase>) {
  const request = createProjectExplanationRequest(raw)
  const compact = { project: { name: raw.name, category: raw.category, frameworks: raw.detectedFrameworks }, parts: raw.projectParts?.map((part) => ({ id: part.id, name: part.name, files: part.relevantFiles?.map((file) => file.path), evidence: part.technicalEvidence })), files: raw.importantFiles?.slice(0, 12).map((file) => ({ path: file.path, preview: file.optionalPreview?.slice(0, 500) })), limitations: request.unsupportedContent }
  return `${request.systemPrompt}\nPrompt version: ${request.promptVersion}\nReturn a JSON object matching PresentationKnowledgeBase. Evidence:\n${JSON.stringify(compact)}`
}

async function runAnalysis(runId: string, modelId: string, variant?: string) {
  const active = runs.get(runId)!; const project = await sampleProject(); event(runId, { type: 'preparing-evidence' })
  const key = cacheKey(project, modelId, variant)
  const cached = completedCache.get(key)
  if (cached) { event(runId, { type: 'completed', result: cached }); return }
  const analysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, () => {})
  const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Sample')
  const executable = resolveOpenCodeExecutable(); if (!executable) throw new Error('OpenCode is unavailable.')
  if (!isSafeAnalysisConfig()) throw new Error('OpenCode runtime safety could not be confirmed. Analysis was not started.')
  const availableModels = await discoverModels(executable)
  if (!availableModels.some((model) => model.fullId === modelId && model.availability === 'available')) throw new Error(`The selected model is no longer available. Refresh models and choose another model.`)
  const workspace = await createAnalysisWorkspace(sampleRoot)
  event(runId, { type: 'starting-agent' }); event(runId, { type: 'analysing' })
  const args = ['run', '--format', 'json', '--agent', 'plan', '--model', modelId, '--dir', workspace.directory]
  if (variant) args.push('--variant', variant)
  try {
    const options = { cwd: workspace.directory, env: analysisEnvironment(), signal: active.controller.signal }
    const result = await runOpenCode(executable, args, evidencePrompt(raw), options)
    const mutation = changedFiles(workspace.before, await fileManifest(workspace.directory))
    if (mutation.length) throw new Error(`OpenCode changed the disposable sample (${mutation.join(', ')}). Result rejected.`)
    if (result.code !== 0) throw new Error(redact(result.stderr) || 'OpenCode analysis failed.')
    event(runId, { type: 'validating' })
    let presentation: unknown
    try { presentation = JSON.parse(extractOpenCodeText(result.stdout)) } catch { throw new Error('OpenCode did not return structured JSON.') }
    let issues = validatePresentationKnowledgeBase(presentation, raw)
    if (issues.length) {
      const repair = await runOpenCode(executable, args, `${evidencePrompt(raw)}\nRepair these validation errors only: ${issues.join('; ')}\nPrevious output: ${JSON.stringify(presentation)}`, options)
      if (changedFiles(workspace.before, await fileManifest(workspace.directory)).length) throw new Error('OpenCode changed the disposable sample. Result rejected.')
      try { presentation = JSON.parse(extractOpenCodeText(repair.stdout)) } catch { throw new Error('OpenCode repair did not return structured JSON.') }
      issues = validatePresentationKnowledgeBase(presentation, raw)
    }
    if (issues.length) throw new Error(`OpenCode output could not be validated: ${issues.join('; ')}`)
    const validPresentation = presentation as PresentationKnowledgeBase
    completedCache.set(key, validPresentation)
    event(runId, { type: 'completed', result: validPresentation })
  } finally { await removeAnalysisWorkspace(workspace.directory) }
}

export const daemon = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/api/runtime/health') return send(res, 200, { status: 'ready', version: '0.1.0' })
  if (req.method === 'GET' && url.pathname === '/api/agents') return send(res, 200, [await detectOpenCode()])
  if (req.method === 'GET' && url.pathname === '/api/agents/opencode/models') { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { return send(res, 200, await discoverModels(detected.executablePath)) } catch (error) { return send(res, 502, { error: error instanceof Error ? error.message : 'Model discovery failed.' }) } }
  if (req.method === 'GET' && url.pathname === '/api/agents/opencode/free-models') { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { return send(res, 200, freeModelIds(await discoverModels(detected.executablePath))) } catch (error) { return send(res, 502, { error: error instanceof Error ? error.message : 'Model discovery failed.' }) } }
  if (req.method === 'GET' && (url.pathname === '/api/opencode/models' || url.pathname === '/api/opencode/providers')) { const detected = await detectOpenCode(); if (!detected.installed || !detected.executablePath) return send(res, 503, { error: detected.error }); try { return send(res, 200, url.pathname.endsWith('/models') ? await discoverModels(detected.executablePath) : await discoverProviders(detected.executablePath)) } catch (error) { return send(res, 502, { error: error instanceof Error ? redact(error instanceof Error ? error.message : String(error)) : 'OpenCode discovery failed.' }) } }
  if (req.method === 'POST' && (url.pathname === '/api/opencode/providers/connect' || url.pathname === '/api/opencode/providers/disconnect')) {
    let body = ''; for await (const chunk of req) body += chunk; let parsed: { providerId?: string }; try { parsed = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid request body.' }) }
    const executable = resolveOpenCodeExecutable(); if (!executable || !parsed.providerId || !/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(parsed.providerId)) return send(res, 400, { error: 'Invalid provider.' })
    const providers = await discoverProviders(executable); if (!providers.some((provider) => provider.id === parsed.providerId)) return send(res, 404, { error: 'Provider is not in OpenCode’s discovered catalogue.' })
    if (url.pathname.endsWith('/connect')) return send(res, 409, { status: 'unsupported', message: 'Connect through OpenCode. This installed CLI uses an interactive authentication flow; Project Lens does not collect or store provider credentials.' })
    const result = await runOpenCode(executable, ['auth', 'logout', parsed.providerId], '', { timeoutMs: 15_000 }); if (result.code !== 0) return send(res, 502, { error: redact(result.stderr) || 'Provider disconnect failed.' }); return send(res, 200, { status: 'disconnected' })
  }
  if (req.method === 'POST' && url.pathname === '/api/analysis/sample') { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 5_000) return send(res, 413, { error: 'Request is too large.' }) } let parsed: { agentId?: string; modelId?: string; variant?: string }; try { parsed = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid request body.' }) } if (parsed.agentId !== 'opencode' || !parsed.modelId || parsed.modelId.includes('..') || parsed.modelId.length > 240 || (parsed.variant !== undefined && (typeof parsed.variant !== 'string' || parsed.variant.length > 80))) return send(res, 400, { error: 'Only an OpenCode model for the prepared sample is allowed.' }); if ([...runs.values()].some((run) => !run.events.some((item) => ['completed', 'failed', 'cancelled'].includes(item.type)))) return send(res, 409, { error: 'One sample analysis is already running.' }); const runId = randomUUID(); runs.set(runId, { events: [{ type: 'queued' }], controller: new AbortController() }); void runAnalysis(runId, parsed.modelId, parsed.variant).catch((error) => event(runId, { type: error instanceof Error && error.message.includes('cancelled') ? 'cancelled' : 'failed', error: error instanceof Error ? error.message : 'Analysis failed.' })); return send(res, 202, { runId }) }
  const match = url.pathname.match(/^\/api\/analysis\/([^/]+)\/(events|cancel)$/)
  if (match) { const run = runs.get(match[1]); if (!run) return send(res, 404, { error: 'Unknown analysis run.' }); if (req.method === 'POST' && match[2] === 'cancel') { run.controller.abort(); event(match[1], { type: 'cancelled' }); return send(res, 202, { status: 'cancelled' }) } if (req.method === 'GET' && match[2] === 'events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); let index = 0; const timer = setInterval(() => { while (index < run.events.length) { const current = run.events[index++]; res.write(`event: ${current.type}\ndata: ${JSON.stringify(current)}\n\n`); if (['completed', 'failed', 'cancelled'].includes(current.type)) { clearInterval(timer); res.end() } } }, 100); req.on('close', () => clearInterval(timer)); return } }
  send(res, 404, { error: 'Not found.' })
})

if (process.argv[1]?.endsWith('server.ts')) daemon.listen(Number(process.env.PROJECT_LENS_API_PORT ?? 8787), '127.0.0.1')
