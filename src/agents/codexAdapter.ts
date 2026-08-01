import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import type { AgentRuntime, AgentAuthenticationStatus, AgentCapabilities, RuntimeReadiness } from './types'

const capabilities: AgentCapabilities = {
  projectRead: true, projectSearch: true, webSearch: false, webFetch: false,
  streaming: true, structuredOutput: true, modelDiscovery: false,
  authenticationDetection: true, cancellation: true, readOnlyEnforcement: true,
}

function candidates() {
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex'] : ['codex']
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const windowsLocations = process.platform === 'win32' ? [
    path.join(process.env.APPDATA ?? '', 'npm'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'codex'),
  ] : []
  return [...pathEntries, ...windowsLocations].flatMap((entry) => names.map((name) => path.join(entry, name)))
}

async function resolveCodex() {
  for (const candidate of candidates()) { try { await access(candidate); return candidate } catch { /* keep scanning */ } }
  return undefined
}

function command(executable: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    let child
    try { child = spawn(executable, args, { shell: false, windowsHide: true }) } catch { resolve({ code: null, stdout: '', stderr: 'Codex could not start.' }); return }
    let stdout = ''; let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', () => resolve({ code: null, stdout, stderr }))
    child.once('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function detect(): Promise<AgentRuntime> {
  const executable = await resolveCodex()
  if (!executable) return runtime({ installationStatus: 'not-installed', readiness: 'not-installed' })
  const version = await command(executable, ['--version'])
  if (version.code !== 0) return runtime({ executable, version: version.stdout.trim() || undefined, installationStatus: 'installed', readiness: 'installed-but-unavailable' })
  const help = await command(executable, ['--help'])
  const authHelp = await command(executable, ['login', '--help'])
  const supportsAuthStatus = /\bstatus\b/i.test(authHelp.stdout)
  let authenticationStatus: AgentAuthenticationStatus = 'disconnected'
  if (supportsAuthStatus) {
    const status = await command(executable, ['login', 'status'])
    authenticationStatus = status.code === 0 ? 'connected' : 'disconnected'
  }
  const readiness: RuntimeReadiness = authenticationStatus === 'connected' ? 'ready' : 'sign-in-required'
  return runtime({ executable, version: version.stdout.trim(), installationStatus: 'installed', authenticationStatus, readiness, defaultModelLabel: help.code === 0 ? 'Codex default model' : undefined })
}

function runtime(overrides: Partial<AgentRuntime>): AgentRuntime {
  const base: AgentRuntime = {
    id: 'codex', displayName: 'Codex', installationStatus: 'not-installed', authenticationStatus: 'disconnected', readiness: 'not-installed', capabilities,
    detect, checkAuthentication: async () => base.authenticationStatus, checkReadiness: async () => base.readiness,
    runAnalysis: async () => { throw new Error('Codex analysis adapter is not yet connected to the coordinator.') },
    cancel: async () => {}, normalizeEvents: () => undefined,
  }
  return { ...base, ...overrides }
}

export function createCodexRuntime() { return runtime({ detect }) }
