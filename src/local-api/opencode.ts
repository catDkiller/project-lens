import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AgentStatusDto, ModelDto } from './contracts'

export interface OpenCodeExecutable { path: string; version: string }
export interface OpenCodeRunResult { stdout: string; stderr: string; code: number | null }

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

export function runOpenCode(executable: string, args: string[], input = '', signal?: AbortSignal, timeoutMs = 90_000): Promise<OpenCodeRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: process.cwd(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
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
    child.once('close', (code) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); if (timedOut) return reject(new Error('OpenCode timed out.')); if (signal?.aborted) return reject(new Error('OpenCode analysis was cancelled.')); resolve({ stdout, stderr, code }) })
    child.stdin.end(input)
  })
}

export async function detectOpenCode(): Promise<AgentStatusDto> {
  const executablePath = resolveOpenCodeExecutable()
  if (!executablePath) return { id: 'opencode', displayName: 'OpenCode', installed: false, status: 'unavailable', error: 'OpenCode was not found on PATH.' }
  try {
    const result = await runOpenCode(executablePath, ['--version'], '', undefined, 10_000)
    return { id: 'opencode', displayName: 'OpenCode', installed: result.code === 0, executablePath, version: result.stdout.trim(), status: result.code === 0 ? 'available' : 'unavailable', error: result.code === 0 ? undefined : redact(result.stderr) }
  } catch (error) { return { id: 'opencode', displayName: 'OpenCode', installed: false, executablePath, status: 'unavailable', error: error instanceof Error ? error.message : 'OpenCode could not start.' } }
}

export async function discoverModels(executable: string): Promise<ModelDto[]> {
  const result = await runOpenCode(executable, ['models'], '', undefined, 30_000)
  if (result.code !== 0) throw new Error(redact(result.stderr) || 'OpenCode could not list models.')
  return mapOpenCodeModels(result.stdout)
}

export function mapOpenCodeModels(output: string): ModelDto[] {
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].map((fullId) => {
    const [providerId, ...rest] = fullId.split('/')
    const modelId = rest.join('/')
    return { providerId, modelId, fullId, displayName: modelId || fullId, availability: 'available' }
  })
}

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
