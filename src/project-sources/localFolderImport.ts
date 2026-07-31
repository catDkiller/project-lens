import type { NormalizedProject, ProjectFile } from './types'

const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.cache'])
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html', '.md', '.txt', '.svg'])
const secretName = /(^|\/)(\.env(?:\..*)?|.*\.(pem|key|p12)|auth\.json)$/i
const MAX_FILE_BYTES = 512_000

export interface LocalCandidate { path: string; content: string; size: number }
export type LocalSkipReason = 'dependency-generated' | 'sensitive' | 'binary-unsupported' | 'oversized' | 'unsafe'
export interface LocalImportSummary { files: ProjectFile[]; skipped: number; size: number; skippedByReason: Record<LocalSkipReason, number> }

export function safeRelativePath(value: string): string | null {
  const path = value.replaceAll('\\', '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..')) return null
  return path
}

export function acceptsLocalPath(value: string, size: number) {
  return classifyLocalPath(value, size) === null
}

export function classifyLocalPath(value: string, size: number): LocalSkipReason | null {
  const path = safeRelativePath(value); const extension = path?.slice(path.lastIndexOf('.')).toLowerCase() ?? ''
  if (!path) return 'unsafe'
  if (path.split('/').some((part) => ignoredDirectories.has(part))) return 'dependency-generated'
  if (secretName.test(path)) return 'sensitive'
  if (size > MAX_FILE_BYTES) return 'oversized'
  if (!textExtensions.has(extension)) return 'binary-unsupported'
  return null
}

export function prepareLocalFiles(candidates: LocalCandidate[]): LocalImportSummary {
  const files: ProjectFile[] = []; const seen = new Set<string>(); let skipped = 0; let size = 0
  const skippedByReason: Record<LocalSkipReason, number> = { 'dependency-generated': 0, sensitive: 0, 'binary-unsupported': 0, oversized: 0, unsafe: 0 }
  for (const candidate of candidates) {
    const path = safeRelativePath(candidate.path)
    const reason = classifyLocalPath(candidate.path, candidate.size) ?? (!path || seen.has(path) || candidate.content.includes('\0') ? 'unsafe' : null)
    if (reason) { skipped++; skippedByReason[reason]++; continue }
    if (!path) { skipped++; skippedByReason.unsafe++; continue }
    seen.add(path); files.push({ path, content: candidate.content }); size += candidate.size
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), skipped, size, skippedByReason }
}

export function localProject(name: string, files: ProjectFile[]): NormalizedProject { return { id: `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}`, name, framework: 'react-vite', files } }
