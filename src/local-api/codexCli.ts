/**
 * Adapted from Open Design's Codex runtime mechanics (Apache-2.0): native
 * executable resolution, stdin prompt delivery, and JSONL event handling.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
export type CodexRuntimeEvent = { type: 'thread_started' | 'status' | 'reasoning' | 'text_delta' | 'tool_call' | 'tool_result' | 'file_write' | 'usage' | 'warning' | 'error' | 'process_exited'; message?: string; threadId?: string; raw?: Record<string, unknown> }
export type CodexCliProbe = { executable: string; version: string; signedIn: boolean; models: string[] }
export type ArtifactReferenceClassification = { kind: 'source-file' | 'runtime-generated' | 'external' | 'unverified'; reference: string; normalized?: string; evidence?: string }
export function normalizeArtifactPath(value: string, manifestPaths: Iterable<string>, options: { artifactRelative?: boolean } = {}): string | null {
  let cleaned = value.trim().replace(/^[`'"([<{]+|[`'">)}.,;:!?]+$/g, '').replaceAll('\\', '/').replace(/\/+/g, '/')
  if (options.artifactRelative && /^\.\.\/source\//i.test(cleaned)) cleaned = cleaned.replace(/^\.\.\/source\//i, '')
  else cleaned = cleaned.replace(/^\.\//, '').replace(/^source\//i, '')
  if (!cleaned || [...cleaned].some((character) => character.charCodeAt(0) < 32) || cleaned.startsWith('/') || cleaned.startsWith('//') || /^[a-z]:\//i.test(cleaned) || cleaned.split('/').some((part) => part === '..')) return null
  const target = cleaned.split('/').filter((part) => part && part !== '.').join('/')
  if (target.includes('*')) return target
  if (/^(models|output|logs|\.cache|cache|skill|artifacts)\//i.test(target) || /\.(task|log)$/i.test(target)) return target
  const paths = [...manifestPaths]; const compare = (path: string) => process.platform === 'win32' ? path.toLowerCase() === target.toLowerCase() : path === target
  const matched = paths.find(compare); if (matched) return matched
  const directory = paths.find((path) => process.platform === 'win32' ? path.toLowerCase().startsWith(`${target.toLowerCase().replace(/\/$/, '')}/`) : path.startsWith(`${target.replace(/\/$/, '')}/`)); if (directory) return target.replace(/\/$/, '')
  const suffixes = paths.filter((path) => (process.platform === 'win32' ? path.toLowerCase().endsWith(`/${target.toLowerCase()}`) : path.endsWith(`/${target}`)))
  return suffixes.length === 1 ? suffixes[0] : null
}
export function classifyArtifactReference(reference: string, context: string, manifestPaths: Iterable<string>): ArtifactReferenceClassification { const normalized = normalizeArtifactPath(reference, manifestPaths); const lower = context.toLowerCase(); if (/^(https?:|git@|npm:)/i.test(reference.trim())) return { kind: 'external', reference }; if (/download|generated|created|saved|cache|output|model asset|runtime dependency|first run/.test(lower)) return { kind: 'runtime-generated', reference, normalized: normalized ?? reference.replaceAll('\\', '/').replace(/^\.?(\/)?source\//i, ''), evidence: context.slice(0, 240) }; if (normalized) return { kind: 'source-file', reference, normalized }; return { kind: 'unverified', reference, normalized: reference.replaceAll('\\', '/') } }

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
export async function stageRun(root: string, runId: string, files: { path: string; content: string }[], skill: string) {
  const directory = path.join(root, '.project-lens', 'runs', runId); const source = path.join(directory, 'source'); const artifacts = path.join(directory, 'artifacts')
  await mkdir(source, { recursive: true }); await mkdir(artifacts, { recursive: true }); await mkdir(path.join(directory, 'skill'), { recursive: true }); await writeFile(path.join(directory, 'skill', 'SKILL.md'), skill, 'utf8')
  for (const file of files) { const target = path.resolve(source, file.path); if (!target.startsWith(source + path.sep)) throw new Error('Unsafe source path.'); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, file.content, 'utf8') }
  return { directory, source, artifacts }
}
export async function readRequiredArtifacts(artifacts: string, sourcePaths: Set<string>) { const names = ['overview.md', 'complete-guide.md'] as const; const values = await Promise.all(names.map(async (name) => { const target = path.resolve(artifacts, name); if (!target.startsWith(artifacts + path.sep) || !(await stat(target)).isFile()) throw new Error(`Missing artifact: ${name}`); const text = await readFile(target, 'utf8'); if (!text.trim() || text.length > 100_000 || /this is a prepared[- ]sample project|fixture project used for demonstration/i.test(text)) throw new Error(`Invalid artifact: ${name}`); const references = [...text.matchAll(/`([^`]+\.(?:[a-z0-9]{1,8}))`|\]\(([^)]+)\)/gi)].map((match) => ({ value: match[1] ?? match[2], link: Boolean(match[2]) })).filter((item) => item.value); for (const reference of references) if (reference.value.includes('/') || reference.value.includes('\\')) { const normalized = normalizeArtifactPath(reference.value, sourcePaths, { artifactRelative: reference.link }); if (!normalized) throw new Error(`Invalid source-file reference: ${reference.value} (normalized: ${reference.value.replaceAll('\\', '/') || 'invalid'})`) } return [name, text] as const })); return Object.fromEntries(values) as Record<(typeof names)[number], string> }
export function runCodexCli(options: { executable: string; args: string[]; cwd: string; prompt: string; onEvent: (event: CodexRuntimeEvent) => void; signal: AbortSignal }) { const child = spawn(options.executable, options.args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); let buffer = ''; let stderr = ''; const handle = (line: string) => { try { const value = JSON.parse(line) as { type?: string; thread_id?: string; item?: { type?: string; command?: string; aggregated_output?: string; text?: string; path?: string }; message?: string }; if (value.type === 'thread.started') options.onEvent({ type: 'thread_started', threadId: value.thread_id, raw: value }); else if (value.type === 'turn.started') options.onEvent({ type: 'status', message: 'Codex session started', raw: value }); else if (value.type === 'item.started' && value.item?.type === 'command_execution') options.onEvent({ type: 'tool_call', message: value.item.command, raw: value }); else if (value.type === 'item.completed' && value.item?.type === 'command_execution') options.onEvent({ type: 'tool_result', message: value.item.aggregated_output, raw: value }); else if (value.type === 'item.completed' && value.item?.type === 'file_change') options.onEvent({ type: 'file_write', message: value.item.path, raw: value }); else if (value.type === 'item.completed' && value.item?.type === 'agent_message') options.onEvent({ type: 'text_delta', message: value.item.text, raw: value }); else if (value.type === 'error' || value.type === 'turn.failed') options.onEvent({ type: 'error', message: typeof value.message === 'string' ? value.message : 'Codex failed', raw: value }); else options.onEvent({ type: 'reasoning', raw: value }) } catch { options.onEvent({ type: 'warning', message: 'Unparseable Codex JSONL line.' }) } }
  child.stdout.on('data', (chunk: Buffer) => { buffer += chunk.toString('utf8'); let index; while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) handle(line) } }); child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-20_000) }); child.stdin.end(options.prompt); options.signal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true }); return new Promise<{ code: number | null; stderr: string; child: ReturnType<typeof spawn> }>((resolve) => child.once('close', (code) => { if (buffer.trim()) handle(buffer.trim()); options.onEvent({ type: 'process_exited', message: String(code) }); resolve({ code, stderr, child }) }))
}
