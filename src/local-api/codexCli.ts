/**
 * Adapted from Open Design's Codex runtime mechanics (Apache-2.0): native
 * executable resolution, stdin prompt delivery, and JSONL event handling.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { access, mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export { classifyArtifactReference, normalizeArtifactPath, readRequiredArtifacts } from './artifacts'

const require = createRequire(import.meta.url)
export type CodexRuntimeEvent = { type: 'thread_started' | 'status' | 'reasoning' | 'text_delta' | 'tool_call' | 'tool_result' | 'file_write' | 'usage' | 'warning' | 'error' | 'process_exited'; message?: string; threadId?: string; raw?: Record<string, unknown> }
export type CodexCliProbe = { executable: string; version: string; signedIn: boolean; models: string[] }

async function command(executable: string, args: string[]) { return await new Promise<{ code: number | null; stdout: string }>((resolve) => { const child = spawn(executable, args, { shell: false, windowsHide: true }); let stdout = ''; child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk).slice(0, 2_000_000) }); child.once('error', () => resolve({ code: null, stdout })); child.once('close', (code) => resolve({ code, stdout })) }) }
export async function resolveCodexCli(): Promise<CodexCliProbe | { error: string }> {
  const candidates: string[] = []
  try { const packageJson = require.resolve('@openai/codex-win32-x64/package.json'); candidates.push(path.join(path.dirname(packageJson), 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')) } catch { /* optional native package */ }
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.USERPROFILE ?? '', '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe'))
    const desktopBins = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin')
    try { for (const entry of (await readdir(desktopBins, { withFileTypes: true })).filter((item) => item.isDirectory()).sort((a, b) => b.name.localeCompare(a.name))) candidates.push(path.join(desktopBins, entry.name, 'codex.exe')) } catch { /* Desktop Codex is optional */ }
  }
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) candidates.push(path.join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex'))
  for (const candidate of [...new Set(candidates)]) {
    try { await access(candidate) } catch { continue }
    if (candidate.replaceAll('\\', '/').includes('/.codex/plugins/.plugin-appserver/')) continue
    const [version, auth, models] = await Promise.all([command(candidate, ['--version']), command(candidate, ['login', 'status']), command(candidate, ['debug', 'models'])])
    if (version.code !== 0) continue
    const parsed = (() => { try { const value = JSON.parse(models.stdout) as { models?: Array<{ slug?: string; id?: string; visibility?: string }> }; return (value.models ?? []).filter((model) => model.visibility !== 'hidden').map((model) => model.slug ?? model.id ?? '').filter(Boolean) } catch { return [] } })()
    return { executable: candidate, version: version.stdout.trim(), signedIn: auth.code === 0, models: parsed }
  }
  return { error: 'Codex CLI is unavailable.' }
}
export function buildCodexArgs(runDirectory: string, model?: string) { return ['exec', '--json', '--skip-git-repo-check', '--sandbox', process.platform === 'win32' ? 'danger-full-access' : 'workspace-write', '-C', runDirectory, ...(model ? ['--model', model] : [])] }
export async function stageRun(root: string, runId: string, files: { path: string; content: string }[], skill: string, onFile?: (file: { path: string; index: number; total: number; bytes: number }) => void) {
  const directory = path.join(root, '.project-lens', 'runs', runId); const source = path.join(directory, 'source'); const artifacts = path.join(directory, 'artifacts')
  await mkdir(source, { recursive: true }); await mkdir(artifacts, { recursive: true }); await mkdir(path.join(directory, 'skill'), { recursive: true }); await writeFile(path.join(directory, 'skill', 'SKILL.md'), skill, 'utf8')
  for (const [index, file] of files.entries()) { const target = path.resolve(source, file.path); if (!target.startsWith(source + path.sep)) throw new Error('Unsafe source path.'); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, file.content, 'utf8'); onFile?.({ path: file.path.replaceAll('\\', '/'), index: index + 1, total: files.length, bytes: Buffer.byteLength(file.content) }) }
  const entries = files.map((file) => ({ path: file.path.replaceAll('\\', '/'), lookupKey: process.platform === 'win32' ? file.path.toLowerCase().replaceAll('\\', '/') : file.path.replaceAll('\\', '/'), bytes: Buffer.byteLength(file.content), sha256: createHash('sha256').update(file.content).digest('hex'), category: /(^|\/)(package\.json|vite\.config|tsconfig|README)/i.test(file.path) ? 'project-control' : /(^|\/)(test|tests|__tests__)\//i.test(file.path) ? 'test' : 'source', included: true }))
  const fingerprint = createHash('sha256').update(entries.map((entry) => `${entry.path}\0${entry.sha256}`).sort().join('\n')).digest('hex')
  await writeFile(path.join(directory, 'source-manifest.json'), JSON.stringify({ schemaVersion: 1, fingerprint, entries }, null, 2), 'utf8')
  return { directory, source, artifacts }
}
export function runCodexCli(options: { executable: string; args: string[]; cwd: string; prompt: string; onEvent: (event: CodexRuntimeEvent) => void; onProcess?: (child: ReturnType<typeof spawn>) => void; signal: AbortSignal }) {
  const child = spawn(options.executable, options.args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  options.onProcess?.(child)
  const decoder = new TextDecoder('utf-8', { fatal: false }); let buffer = ''; let stderr = ''
  const handle = (line: string) => {
    if (line.length > 1_000_000) return options.onEvent({ type: 'warning', message: 'Codex emitted an oversized JSONL line.' })
    try {
      const value = JSON.parse(line.replace(/^\uFEFF/, '')) as { type?: string; thread_id?: string; item?: { type?: string; command?: string; aggregated_output?: string; text?: string; path?: string }; message?: string }
      if (value.type === 'thread.started') options.onEvent({ type: 'thread_started', threadId: value.thread_id, raw: value })
      else if (value.type === 'turn.started') options.onEvent({ type: 'status', message: 'Codex session started', raw: value })
      else if (value.type === 'item.started' && value.item?.type === 'command_execution') options.onEvent({ type: 'tool_call', message: value.item.command, raw: value })
      else if (value.type === 'item.completed' && value.item?.type === 'command_execution') options.onEvent({ type: 'tool_result', message: value.item.aggregated_output, raw: value })
      else if (value.type === 'item.completed' && value.item?.type === 'file_change') options.onEvent({ type: 'file_write', message: value.item.path, raw: value })
      else if (value.type === 'item.completed' && value.item?.type === 'agent_message') options.onEvent({ type: 'text_delta', message: value.item.text, raw: value })
      else if (value.type === 'error' || value.type === 'turn.failed') options.onEvent({ type: 'error', message: typeof value.message === 'string' ? value.message : 'Codex failed', raw: value })
      else options.onEvent({ type: 'reasoning', raw: value })
    } catch { options.onEvent({ type: 'warning', message: 'Unparseable Codex JSONL line.' }) }
  }
  const drain = () => { let index: number; while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index).trimEnd(); buffer = buffer.slice(index + 1); if (line.trim()) handle(line) } }
  child.stdout.on('data', (chunk: Buffer) => { buffer += decoder.decode(chunk, { stream: true }); drain() })
  child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + new TextDecoder().decode(chunk)).slice(-20_000) })
  child.stdin.end(options.prompt)
  options.signal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true })
  return new Promise<{ code: number | null; stderr: string; child: ReturnType<typeof spawn> }>((resolve) => child.once('close', (code) => { buffer += decoder.decode(); if (buffer.trim()) handle(buffer.trim()); options.onEvent({ type: 'process_exited', message: String(code) }); resolve({ code, stderr, child }) }))
}
