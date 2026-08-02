import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'

const MAX_OUTPUT = 1_000_000
const require = createRequire(import.meta.url)

export interface CodexProbe {
  executable: string
  version: string
  signedIn: boolean
}

type CommandResult = { code: number | null; stdout: string; stderr: string }

function officialCandidates() {
  const candidates: string[] = []
  try {
    const packageJson = require.resolve('@openai/codex-win32-x64/package.json')
    candidates.push(path.join(path.dirname(packageJson), 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'))
  } catch { /* another platform or optional package not installed */ }
  if (process.platform === 'win32') candidates.push(path.join(process.env.USERPROFILE ?? '', '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe'))
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex'] : ['codex']
  for (const entry of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) for (const name of names) candidates.push(path.join(entry, name))
  return [...new Set(candidates)].filter((candidate) => !candidate.toLowerCase().includes(`${path.sep}.codex${path.sep}plugins${path.sep}.plugin-appserver${path.sep}`))
}

async function command(executable: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try { child = spawn(executable, args, { shell: false, windowsHide: true }) } catch { resolve({ code: null, stdout: '', stderr: 'Codex could not start.' }); return }
    let stdout = ''; let stderr = ''; let settled = false
    const finish = (code: number | null) => { if (!settled) { settled = true; resolve({ code, stdout, stderr }) } }
    child.stdout?.on('data', (chunk: Buffer) => { stdout = (stdout + chunk).slice(0, MAX_OUTPUT) })
    child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk).slice(0, MAX_OUTPUT) })
    child.once('error', () => finish(null)); child.once('close', finish)
  })
}

export async function detectCodex(): Promise<CodexProbe | { error: string }> {
  let firstValid: CodexProbe | undefined
  for (const executable of officialCandidates()) {
    try { await access(executable) } catch { continue }
    const [version, help, login] = await Promise.all([command(executable, ['--version']), command(executable, ['exec', '--help']), command(executable, ['login', 'status'])])
    if (version.code !== 0 || help.code !== 0 || !/--json/.test(help.stdout) || !/--ephemeral/.test(help.stdout) || !/read-only/.test(help.stdout)) continue
    const probe = { executable, version: version.stdout.trim(), signedIn: login.code === 0 }
    firstValid ??= probe
    if (probe.signedIn) return probe
  }
  return firstValid ?? { error: 'Codex is unavailable. Install the official Codex CLI, then restart Project Lens.' }
}

export function sanitizedCodexEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'CODEX_API_KEY' && key !== 'OPENAI_API_KEY')) as Record<string, string>
}

export function parseCodexJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) } catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Codex did not return JSON project knowledge.')
  }
}

export function redact(value: string) {
  const escape = String.fromCharCode(27)
  return value.replace(new RegExp(`${escape}\\[[0-?]*[ -/]*[@-~]`, 'g'), '').replace(/(api[_-]?key|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500)
}
