import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AgentStatusDto, ModelAvailability, ModelDto, ProviderDto } from './contracts'

export interface OpenCodeExecutable { path: string; version: string }
export interface OpenCodeRunResult { stdout: string; stderr: string; code: number | null }
export type OpenCodeTimeoutType = 'process-start' | 'provider-first-response' | 'inactivity' | 'total-run'
export interface OpenCodeRunOptions { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutMs?: number; timeoutType?: OpenCodeTimeoutType }
export class OpenCodeTimeoutError extends Error { readonly timeoutType: OpenCodeTimeoutType; constructor(timeoutType: OpenCodeTimeoutType) { super(`OpenCode timed out (${timeoutType}).`); this.timeoutType = timeoutType; this.name = 'OpenCodeTimeoutError' } }

const analysisPermissions = { '*': 'deny', read: 'allow', list: 'allow', glob: 'allow', grep: 'allow', edit: 'deny', bash: 'deny', task: 'deny', webfetch: 'deny', websearch: 'deny', external_directory: 'deny', question: 'deny', skill: 'deny', todowrite: 'deny' } as const

export const analysisPermissionConfig = {
  $schema: 'https://opencode.ai/config.json', share: 'disabled', snapshot: false, autoupdate: false, formatter: false, lsp: false, plugin: [],
  permission: analysisPermissions,
  agent: { plan: { permission: analysisPermissions } },
} as const

export function analysisEnvironment(env: NodeJS.ProcessEnv = process.env) { return { ...env, OPENCODE_CONFIG_CONTENT: JSON.stringify(analysisPermissionConfig) } }

export function isSafeAnalysisConfig(config: typeof analysisPermissionConfig = analysisPermissionConfig) {
  const permissions = config.permission
  return permissions['*'] === 'deny' && ['read', 'list', 'glob', 'grep'].every((name) => permissions[name as keyof typeof permissions] === 'allow') && ['edit', 'bash', 'task', 'webfetch', 'websearch', 'external_directory', 'question', 'skill', 'todowrite'].every((name) => permissions[name as keyof typeof permissions] === 'deny')
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
    const { cwd = process.cwd(), env = process.env, signal, timeoutMs = 90_000, timeoutType = 'total-run' } = options
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''; let timedOut = false
    const terminate = () => {
      if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' })
      else child.kill('SIGTERM')
    }
    const timer = setTimeout(() => { timedOut = true; terminate() }, timeoutMs)
    const abort = () => terminate()
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); if (stdout.length > 1_000_000) terminate() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); if (stderr.length > 100_000) terminate() })
    child.once('error', reject)
    child.once('close', (code) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); if (timedOut) return reject(new OpenCodeTimeoutError(timeoutType)); if (signal?.aborted) return reject(new Error('OpenCode analysis was cancelled.')); resolve({ stdout, stderr, code }) })
    child.stdin.end(input)
  })
}

export function launchOpenCodeAuth(executable: string, providerId: string) {
  const child = spawn(executable, ['auth', 'login', providerId], { cwd: process.cwd(), shell: false, windowsHide: false, detached: true, stdio: 'ignore' })
  child.unref()
  return { status: 'started' as const, message: 'Complete the connection in the OpenCode window.' }
}

export async function detectOpenCode(): Promise<AgentStatusDto> {
  const executablePath = resolveOpenCodeExecutable()
  if (!executablePath) return { id: 'opencode', displayName: 'OpenCode', installed: false, status: 'unavailable', error: 'OpenCode was not found on PATH.' }
  try {
    const result = await runOpenCode(executablePath, ['--version'], '', { timeoutMs: 10_000 })
    return { id: 'opencode', displayName: 'OpenCode', installed: result.code === 0, executablePath, version: result.stdout.trim(), status: result.code === 0 ? 'available' : 'unavailable', error: result.code === 0 ? undefined : redact(result.stderr) }
  } catch (error) { return { id: 'opencode', displayName: 'OpenCode', installed: false, executablePath, status: 'unavailable', error: error instanceof Error ? error.message : 'OpenCode could not start.' } }
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

export function freeModelIds(models: ModelDto[]) { return models.filter((model) => model.free === true).map((model) => model.fullId) }

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

export function redact(value: string) { return value.replace(/(api[_-]?key|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500) }
