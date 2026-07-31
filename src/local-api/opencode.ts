import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { PROJECT_EXPLANATION_PROMPT_VERSION, PROJECT_EXPLANATION_SYSTEM_PROMPT } from '../knowledge'
import type { ProjectKnowledgeBase } from '../knowledge'
import type { AgentStatusDto, AnalysisFailureCode, ModelAvailability, ModelDto, ProviderDto } from './contracts'

export interface OpenCodeExecutable { path: string; version: string }
export interface OpenCodeRunResult { stdout: string; stderr: string; code: number | null }
export type OpenCodeTimeoutType = 'process-start' | 'provider-first-response' | 'inactivity' | 'total-run'
export interface OpenCodeRunOptions { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutMs?: number; timeoutType?: OpenCodeTimeoutType; processStartTimeoutMs?: number; firstResponseTimeoutMs?: number; inactivityTimeoutMs?: number; totalRunTimeoutMs?: number; onStdoutEvent?: (event: Record<string, unknown>) => void }
export const OPEN_CODE_TIMEOUTS = { processStartMs: 30_000, firstResponseMs: 4 * 60_000, inactivityMs: 2 * 60_000, totalRunMs: 10 * 60_000 } as const
export const PROJECT_LENS_REQUEST_SCHEMA_MARKER = 'project-lens-request-v1'
export const OPEN_CODE_RUN_PROMPT = 'Read the attached Project Lens request, inspect the approved project when needed, and return only the required structured JSON.'
export class OpenCodeTimeoutError extends Error { readonly timeoutType: OpenCodeTimeoutType; constructor(timeoutType: OpenCodeTimeoutType) { super(`OpenCode timed out (${timeoutType}).`); this.timeoutType = timeoutType; this.name = 'OpenCodeTimeoutError' } }
export class OpenCodeFailureError extends Error {
  readonly code: AnalysisFailureCode
  constructor(code: AnalysisFailureCode, message: string) { super(message); this.code = code; this.name = 'OpenCodeFailureError' }
}

const openCodeCapabilities = {
  projectRead: true,
  projectSearch: true,
  webSearch: true,
  webFetch: true,
  streaming: true,
  structuredOutput: true,
  modelDiscovery: true,
  authenticationDetection: true,
  cancellation: true,
  readOnlyEnforcement: true,
} as const

const baseAnalysisPermissions = { '*': 'deny', read: 'allow', list: 'allow', glob: 'allow', grep: 'allow', edit: 'deny', bash: 'deny', task: 'deny', webfetch: 'deny', websearch: 'deny', external_directory: 'deny', question: 'deny', skill: 'deny', todowrite: 'deny' } as const

export function analysisPermissionConfig(webResearchEnabled = true) {
  const webPermissions = webResearchEnabled ? { webfetch: 'allow', websearch: 'allow' } : { webfetch: 'deny', websearch: 'deny' }
  const permission = { ...baseAnalysisPermissions, ...webPermissions }
  return {
    $schema: 'https://opencode.ai/config.json',
    share: 'disabled',
    snapshot: false,
    autoupdate: false,
    formatter: false,
    lsp: false,
    plugin: [],
    permission,
    agent: { plan: { permission } },
  } as const
}

export function analysisEnvironment(env: NodeJS.ProcessEnv = process.env, webResearchEnabled = true) {
  const next: NodeJS.ProcessEnv = { ...env, OPENCODE_CONFIG_CONTENT: JSON.stringify(analysisPermissionConfig(webResearchEnabled)) }
  if (webResearchEnabled) next.OPENCODE_ENABLE_EXA = '1'
  return next
}

export function isSafeAnalysisConfig(config: ReturnType<typeof analysisPermissionConfig> = analysisPermissionConfig()) {
  const permissions = config.permission
  const webAllowed = permissions.webfetch === 'allow' && permissions.websearch === 'allow'
  const webDenied = permissions.webfetch === 'deny' && permissions.websearch === 'deny'
  return permissions['*'] === 'deny' && ['read', 'list', 'glob', 'grep'].every((name) => permissions[name as keyof typeof permissions] === 'allow') && ['edit', 'bash', 'task', 'external_directory', 'question', 'skill', 'todowrite'].every((name) => permissions[name as keyof typeof permissions] === 'deny') && (webAllowed || webDenied)
}

export function buildAnalysisCacheBasis(project: Pick<ProjectKnowledgeBase, 'id' | 'name'>, agentId: string, modelId: string, variant?: string) {
  return JSON.stringify({ projectId: project.id, projectName: project.name, agentId, modelId, variant, promptVersion: PROJECT_EXPLANATION_PROMPT_VERSION })
}

export function buildAnalysisCacheKey(project: Pick<ProjectKnowledgeBase, 'id' | 'name'>, agentId: string, modelId: string, variant?: string) {
  return createHash('sha256').update(buildAnalysisCacheBasis(project, agentId, modelId, variant)).digest('hex')
}

export function sanitizeResearchMetadata(value: string) {
  return redact(value.replace(/\r?\n/g, ' ').replace(/(?:[A-Za-z]:[\\/]|\/)[^\s"'<>]+/g, '[path]')).slice(0, 500)
}

export function buildProjectRequestFile(rawKnowledge: ProjectKnowledgeBase, webResearchEnabled = true) {
  return JSON.stringify({
    schemaMarker: PROJECT_LENS_REQUEST_SCHEMA_MARKER,
    promptVersion: PROJECT_EXPLANATION_PROMPT_VERSION,
    explanationSchema: 'PresentationKnowledgeBase',
    systemPrompt: PROJECT_EXPLANATION_SYSTEM_PROMPT,
    writingRules: [
      'Return JSON only.',
      'Do not invent files, features, technologies, or claims.',
      'Use the supplied evidence and limitations only.',
      'Keep uncertain claims clearly marked.',
    ],
    evidenceIds: rawKnowledge.importantFiles?.map((file) => file.id) ?? [],
    projectLimitations: rawKnowledge.limitations ?? [],
    webResearchPreference: webResearchEnabled ? 'enabled' : 'disabled',
    deterministicProjectEvidence: rawKnowledge,
  }, null, 2)
}

export function resolveOpenCodeExecutable(env: NodeJS.ProcessEnv = process.env): string | null {
  const dirs = (env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const name of process.platform === 'win32' ? ['opencode.exe', 'opencode.cmd', 'opencode.bat'] : ['opencode']) {
      const candidate = path.join(dir, name)
      if (!existsSync(candidate)) continue
      if (/\.(cmd|bat)$/i.test(candidate)) {
        const match = readFileSync(candidate, 'utf8').match(/"([^"]+opencode\.exe)"/i)
        const executable = match?.[1]?.replace(/%dp0%/ig, `${path.dirname(candidate)}${path.sep}`)
        if (executable && existsSync(executable)) return executable
      }
      return candidate
    }
  }
  return null
}

export function runOpenCode(executable: string, args: string[], input = '', options: OpenCodeRunOptions = {}): Promise<OpenCodeRunResult> {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), env = process.env, signal } = options
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''; let timeout: OpenCodeTimeoutType | undefined; let receivedOutput = false; let runtimeFailure: OpenCodeFailureError | undefined; let eventBuffer = ''
    const timers: NodeJS.Timeout[] = []
    const terminate = () => { if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' }); else child.kill('SIGTERM') }
    const stopTimers = () => timers.splice(0).forEach(clearTimeout)
    const failAfter = (milliseconds: number | undefined, type: OpenCodeTimeoutType) => { if (milliseconds) timers.push(setTimeout(() => { timeout = type; terminate() }, milliseconds)) }
    const restartInactivity = () => { const index = timers.findIndex((timer) => timer === inactivityTimer); if (index >= 0) { clearTimeout(timers[index]); timers.splice(index, 1) }; inactivityTimer = setTimeout(() => { timeout = 'inactivity'; terminate() }, options.inactivityTimeoutMs ?? OPEN_CODE_TIMEOUTS.inactivityMs); timers.push(inactivityTimer) }
    let inactivityTimer: NodeJS.Timeout
    const processEventLine = (line: string) => { if (!line.trim()) return; try { const parsed = JSON.parse(line) as Record<string, unknown>; if (!receivedOutput) { receivedOutput = true; stopTimers(); failAfter(options.totalRunTimeoutMs ?? options.timeoutMs ?? OPEN_CODE_TIMEOUTS.totalRunMs, options.timeoutType ?? 'total-run') }; restartInactivity(); options.onStdoutEvent?.(parsed) } catch { /* Ignore non-JSON stdout; stderr is the diagnostic channel. */ } }
    failAfter(options.processStartTimeoutMs ?? OPEN_CODE_TIMEOUTS.processStartMs, 'process-start')
    failAfter(options.totalRunTimeoutMs ?? options.timeoutMs ?? OPEN_CODE_TIMEOUTS.totalRunMs, options.timeoutType ?? 'total-run')
    child.once('spawn', () => { stopTimers(); failAfter(options.firstResponseTimeoutMs ?? OPEN_CODE_TIMEOUTS.firstResponseMs, 'provider-first-response'); failAfter(options.totalRunTimeoutMs ?? options.timeoutMs ?? OPEN_CODE_TIMEOUTS.totalRunMs, options.timeoutType ?? 'total-run') })
    const abort = () => terminate()
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (data: Buffer) => { const text = data.toString(); stdout += text; eventBuffer += text; const lines = eventBuffer.split(/\r?\n/); eventBuffer = lines.pop() ?? ''; lines.forEach(processEventLine); if (stdout.length > 1_000_000) terminate() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); if (/quota|rate[ -]?limit|\b429\b/i.test(stderr) && !runtimeFailure) { runtimeFailure = new OpenCodeFailureError('free-quota-or-rate-limit', redact(stderr)); terminate() }; if (stderr.length > 100_000) terminate() })
    child.once('error', (error) => { stopTimers(); reject(error) })
    child.once('close', (code) => { if (eventBuffer.trim()) processEventLine(eventBuffer); stopTimers(); signal?.removeEventListener('abort', abort); if (runtimeFailure) return reject(runtimeFailure); if (timeout) return reject(new OpenCodeTimeoutError(timeout)); if (signal?.aborted) return reject(new Error('OpenCode analysis was cancelled.')); resolve({ stdout, stderr, code }) })
    child.stdin.end(input)
  })
}

export function buildAnalysisArgs(modelId: string, workspaceDirectory: string, requestFile: string, variant?: string) {
  const args = ['run', '--format', 'json', '--agent', 'plan', '--model', modelId, '--dir', workspaceDirectory, '--file', requestFile, OPEN_CODE_RUN_PROMPT]
  if (variant) args.push('--variant', variant)
  return args
}

export function openCodeDiagnosticArgs(enabled: boolean) { return enabled ? ['--print-logs', '--log-level', 'DEBUG'] : [] }

export function launchOpenCodeAuth(executable: string, _providerId: string, onClose: (code: number | null) => void, onError: (error: Error) => void) {
  const isWindows = process.platform === 'win32'
  // OpenCode 1.18.5 treats the positional auth argument as a URL/provider
  // selector. Launch the normal TUI instead so the user can choose OpenCode
  // Zen through `/connect` without Project Lens guessing a CLI argument.
  const command = 'opencode'
  const child = isWindows
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'start', '"Project Lens OpenCode connection"', '/wait', 'cmd.exe', '/k', executable], { cwd: process.cwd(), shell: false, windowsHide: false, detached: true, stdio: 'ignore' })
    : spawn(executable, [], { cwd: process.cwd(), shell: false, detached: true, stdio: 'ignore' })
  child.once('close', onClose)
  child.once('error', onError)
  child.unref()
  return { pid: child.pid, command }
}

export async function detectOpenCode(): Promise<AgentStatusDto> {
  const executablePath = resolveOpenCodeExecutable()
  if (!executablePath) return { id: 'opencode', displayName: 'OpenCode', installed: false, status: 'unavailable', readiness: 'unavailable', capabilities: openCodeCapabilities, error: 'OpenCode was not found on PATH.' }
  try {
    const result = await runOpenCode(executablePath, ['--version'], '', { timeoutMs: 10_000 })
    return { id: 'opencode', displayName: 'OpenCode', installed: result.code === 0, executablePath, version: result.stdout.trim(), status: result.code === 0 ? 'available' : 'unavailable', readiness: result.code === 0 ? 'installed' : 'unhealthy', capabilities: openCodeCapabilities, error: result.code === 0 ? undefined : redact(result.stderr) }
  } catch (error) { return { id: 'opencode', displayName: 'OpenCode', installed: false, executablePath, status: 'unavailable', readiness: 'unavailable', capabilities: openCodeCapabilities, error: error instanceof Error ? error.message : 'OpenCode could not start.' } }
}

export async function discoverModels(executable: string): Promise<ModelDto[]> {
  const result = await runOpenCode(executable, ['models'], '', { timeoutMs: 30_000 })
  if (result.code !== 0) throw new Error(redact(result.stderr) || 'OpenCode could not list models.')
  return mapOpenCodeModels(result.stdout)
}

export async function discoverProviders(executable: string): Promise<ProviderDto[]> {
  const [auth, models] = await Promise.all([runOpenCode(executable, ['auth', 'list'], '', { timeoutMs: 15_000 }), discoverModels(executable)])
  if (auth.code !== 0) throw new Error(redact(auth.stderr) || 'OpenCode could not list providers.')
  const connected = new Map<string, ProviderDto>()
  for (const line of cleanCliOutput(auth.stdout).split(/\r?\n/).map((value) => value.trim())) {
    const match = line.match(/^[•*-]\s+(.+?)\s+(api|oauth|env|[A-Z][A-Z0-9_]{2,})$/i)
    if (match) { const id = match[1].toLowerCase().replace(/\s+/g, '-'); const method = /^(api|oauth)$/i.test(match[2]) ? match[2].toLowerCase() : 'env'; connected.set(id, { id, displayName: match[1], connected: true, connectionMethod: method }) }
  }
  for (const model of models) if (!connected.has(model.providerId)) connected.set(model.providerId, { id: model.providerId, displayName: model.providerId, connected: false })
  return [...connected.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function mapOpenCodeProviders(output: string, modelProviderIds: string[] = []): ProviderDto[] {
  const providers = new Map<string, ProviderDto>()
  for (const line of cleanCliOutput(output).split(/\r?\n/).map((value) => value.trim())) { const match = line.match(/^[•*-]\s+(.+?)\s+(api|oauth|env|[A-Z][A-Z0-9_]{2,})$/i); if (match) { const id = match[1].toLowerCase().replace(/\s+/g, '-'); const method = /^(api|oauth)$/i.test(match[2]) ? match[2].toLowerCase() : 'env'; providers.set(id, { id, displayName: match[1], connected: true, connectionMethod: method }) } }
  for (const id of modelProviderIds) if (!providers.has(id)) providers.set(id, { id, displayName: id, connected: false })
  return [...providers.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function mapOpenCodeModels(output: string): ModelDto[] {
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].map((fullId) => {
    const [providerId, ...rest] = fullId.split('/')
    const modelId = rest.join('/')
    return { providerId, modelId, fullId, displayName: modelId || fullId, availability: 'available', free: fullId.includes(':free'), local: /^(ollama|lmstudio|local)(\/|$)/i.test(providerId) }
  })
}

/** Catalogue output is not proof that a model can run. Enrich it only after auth discovery. */
export function applyProviderAvailability(models: ModelDto[], providers: ProviderDto[]): ModelDto[] {
  const connected = new Map(providers.map((provider) => [provider.id, provider.connected]))
  return models.map((model) => {
    const isConnected = connected.get(model.providerId)
    const availability: ModelAvailability = isConnected === true ? 'ready' : isConnected === false ? 'requires-provider' : 'unknown'
    return { ...model, availability, connected: isConnected === true, runnable: isConnected === true, availabilityReason: isConnected === true ? undefined : isConnected === false ? 'Connect this provider in OpenCode first.' : 'Provider availability could not be confirmed.' }
  })
}

/** The final local gate before `opencode run`; catalogue membership is insufficient. */
export function canStartOpenCodeAnalysis(model: ModelDto | undefined) { return model?.availability === 'ready' && model.runnable === true }

export function freeModelIds(models: ModelDto[]) { return models.filter((model) => model.free === true).map((model) => model.fullId) }

/** Maps only known, redacted runtime failures to a user-safe category. */
export function classifyOpenCodeFailure(error: unknown): AnalysisFailureCode {
  if (error instanceof OpenCodeFailureError) return error.code
  if (error instanceof OpenCodeTimeoutError) return 'network-or-provider-failure'
  const message = error instanceof Error ? error.message : String(error)
  if (/auth(?:entication)?|credential|not connected|connect this provider/i.test(message)) return 'provider-authentication-required'
  if (/quota|rate[ -]?limit|\b429\b/i.test(message)) return 'free-quota-or-rate-limit'
  if (/model.*(?:not found|unavailable)|unknown model/i.test(message)) return 'model-unavailable'
  if (/invalid (?:argument|option)|unknown option/i.test(message)) return 'invalid-opencode-arguments'
  if (/permission|config(?:uration)?|unsafe runtime|database is locked/i.test(message)) return 'permission-or-configuration-failure'
  if (/spawn|enoent|could not start|executable/i.test(message)) return 'process-startup-failure'
  if (/structured json|return.*json|parse/i.test(message)) return 'parser-failure'
  if (/network|fetch|econn|enotfound|provider/i.test(message)) return 'network-or-provider-failure'
  return 'unknown'
}

export function openCodeFailureMessage(code: AnalysisFailureCode) {
  const messages: Record<AnalysisFailureCode, string> = {
    'provider-authentication-required': 'This model is provided through OpenCode and needs an authenticated OpenCode provider before it can run.',
    'free-quota-or-rate-limit': 'The selected provider reported a quota or rate-limit problem. Wait and try again, or choose another ready model.',
    'model-unavailable': 'The selected model is no longer available from its provider. Refresh models and choose another one.',
    'network-or-provider-failure': 'OpenCode could not reach the selected provider. Check the provider connection and try again.',
    'invalid-opencode-arguments': 'Project Lens could not start OpenCode with the selected model. Choose another model or refresh the runtime.',
    'permission-or-configuration-failure': 'OpenCode runtime safety or configuration could not be confirmed. Analysis was not started.',
    'process-startup-failure': 'OpenCode could not start locally. Check the local OpenCode installation and try again.',
    'parser-failure': 'OpenCode returned an unreadable result. No project changes were made.',
    unknown: 'OpenCode could not complete the analysis. No project changes were made.',
  }
  return messages[code]
}

function cleanCliOutput(value: string) { return value.replace(new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g'), '') }

export function extractOpenCodeText(output: string): string {
  const text: string[] = []
  for (const line of output.split(/\r?\n/)) {
    try {
      const value = JSON.parse(line) as Record<string, unknown>
      const candidate = value.text ?? (value.part as Record<string, unknown> | undefined)?.text ?? (value.message as Record<string, unknown> | undefined)?.text
      if (typeof candidate === 'string') text.push(candidate)
    } catch { /* JSON mode can still emit a plain final line. */ }
  }
  return text.at(-1) ?? output.trim()
}

export function parseOpenCodeEvents(output: string) { return output.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => { try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] } }) }

export function redact(value: string) { return value.replace(/(api[_-]?key|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500) }
