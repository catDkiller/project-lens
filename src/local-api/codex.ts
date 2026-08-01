import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'

const MAX_OUTPUT = 1_000_000
export const CODEX_TIMEOUTS = { processStartMs: 30_000, firstResponseMs: 240_000, inactivityMs: 120_000, totalRunMs: 600_000 }

export interface CodexProbe { executable: string; version: string; signedIn: boolean; supportsModelOverride: boolean }
export interface CodexRunResult { code: number | null; stdout: string; stderr: string; events: Record<string, unknown>[]; completed: boolean }
export interface CodexRunOptions { cwd: string; input: string; model?: string; signal?: AbortSignal; onProcess?: (child: ChildProcess) => void; onEvent?: (event: Record<string, unknown>) => void }

function candidates() {
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex'] : ['codex']
  const entries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const known = process.platform === 'win32' ? [path.join(process.env.USERPROFILE ?? '', '.codex', 'plugins', '.plugin-appserver'), path.join(process.env.USERPROFILE ?? '', '.codex', '.sandbox-bin')] : []
  return [...known, ...entries].flatMap((entry) => names.map((name) => path.join(entry, name)))
}

async function command(executable: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    let child: ChildProcess
    try { child = spawn(executable, args, { shell: false, windowsHide: true }) } catch { resolve({ code: null, stdout: '', stderr: 'Codex could not start.' }); return }
    let stdout = ''; let stderr = ''; let settled = false
    const finish = (code: number | null) => { if (!settled) { settled = true; resolve({ code, stdout, stderr }) } }
    child.stdout?.on('data', (chunk: Buffer) => { stdout = (stdout + chunk).slice(0, MAX_OUTPUT) })
    child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk).slice(0, MAX_OUTPUT) })
    child.once('error', () => finish(null)); child.once('close', finish)
  })
}

export async function detectCodex(): Promise<CodexProbe | { error: string }> {
  for (const candidate of candidates()) {
    try { await access(candidate) } catch { continue }
    const version = await command(candidate, ['--version'])
    const help = await command(candidate, ['exec', '--help'])
    if (version.code !== 0 || help.code !== 0 || !/--json/.test(help.stdout) || !/--ephemeral/.test(help.stdout) || !/read-only/.test(help.stdout)) continue
    const supportsModelOverride = /--model\s+<MODEL>/i.test(help.stdout)
    const login = await command(candidate, ['login', 'status'])
    if (login.code === 0) return { executable: candidate, version: version.stdout.trim(), signedIn: true, supportsModelOverride }
    // Keep looking: a stale bundled binary may be present before the user's authenticated CLI.
    const fallback = { executable: candidate, version: version.stdout.trim(), signedIn: false }
    const remaining = candidates().slice(candidates().indexOf(candidate) + 1)
    for (const next of remaining) {
      try { await access(next) } catch { continue }
      const nextVersion = await command(next, ['--version']); const nextHelp = await command(next, ['exec', '--help']); const nextLogin = await command(next, ['login', 'status'])
      if (nextVersion.code === 0 && nextHelp.code === 0 && /--json/.test(nextHelp.stdout) && /--ephemeral/.test(nextHelp.stdout) && /read-only/.test(nextHelp.stdout) && nextLogin.code === 0) return { executable: next, version: nextVersion.stdout.trim(), signedIn: true, supportsModelOverride: /--model\s+<MODEL>/i.test(nextHelp.stdout) }
    }
    return { ...fallback, supportsModelOverride }
  }
  return { error: 'Codex is unavailable. Start Codex Desktop or install the Codex CLI, then restart Project Lens.' }
}

export function codexArgs(workspace: string, model?: string) { return ['exec', '--json', '--ephemeral', '--sandbox', 'read-only', '-C', workspace, '--skip-git-repo-check', ...(model ? ['--model', model] : []), '-'] }

export function extractCodexText(events: Record<string, unknown>[]) {
  return events.flatMap((event) => {
    const item = event.item as { type?: unknown; text?: unknown } | undefined
    return event.type === 'item.completed' && item?.type === 'agent_message' && typeof item.text === 'string' ? [item.text] : []
  }).at(-1) ?? ''
}

export function parseCodexJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) } catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Codex did not return JSON project knowledge.')
  }
}

export async function runCodex(executable: string, options: CodexRunOptions): Promise<CodexRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, codexArgs(options.cwd, options.model), { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    options.onProcess?.(child)
    let stdout = ''; let stderr = ''; const events: Record<string, unknown>[] = []; let buffer = ''; let completed = false; let settled = false
    const done = (code: number | null) => { if (!settled) { settled = true; resolve({ code, stdout, stderr, events, completed }) } }
    const consume = (chunk: Buffer) => {
      stdout = (stdout + chunk).slice(0, MAX_OUTPUT); buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? ''
      for (const line of lines) try { const event = JSON.parse(line) as Record<string, unknown>; events.push(event); if (event.type === 'turn.completed') completed = true; options.onEvent?.(event) } catch { /* unknown stdout is retained for diagnostics */ }
    }
    child.stdout?.on('data', consume); child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk).slice(0, MAX_OUTPUT) })
    child.once('error', reject); child.once('close', done)
    options.signal?.addEventListener('abort', () => { child.kill(); reject(new Error('Analysis cancelled.')) }, { once: true })
    child.stdin?.end(options.input)
  })
}

export function redact(value: string) { return value.replaceAll('\u001b', '').replaceAll('\u009b', '').replace(/(api[_-]?key|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 500) }
