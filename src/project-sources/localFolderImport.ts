import type { NormalizedProject, ProjectFile } from './types'

const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.cache'])
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html', '.md', '.txt', '.svg'])
const secretName = /(^|\/)(\.env(?:\.|$)|.*\.(pem|key|p12)|auth\.json)$/i
const MAX_FILE_BYTES = 512_000

export interface LocalCandidate { path: string; content: string; size: number }
export interface LocalImportSummary { files: ProjectFile[]; skipped: number; size: number }

export function safeRelativePath(value: string): string | null {
  const path = value.replaceAll('\\', '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..')) return null
  return path
}

export function acceptsLocalPath(value: string, size: number) {
  const path = safeRelativePath(value); const extension = path?.slice(path.lastIndexOf('.')).toLowerCase() ?? ''
  return Boolean(path && !path.split('/').some((part) => ignoredDirectories.has(part)) && !secretName.test(path) && textExtensions.has(extension) && size <= MAX_FILE_BYTES)
}

export function prepareLocalFiles(candidates: LocalCandidate[]): LocalImportSummary {
  const files: ProjectFile[] = []; const seen = new Set<string>(); let skipped = 0; let size = 0
  for (const candidate of candidates) {
    const path = safeRelativePath(candidate.path)
    if (!path || seen.has(path) || !acceptsLocalPath(path, candidate.size) || candidate.content.includes('\0')) { skipped++; continue }
    seen.add(path); files.push({ path, content: candidate.content }); size += candidate.size
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), skipped, size }
}

export function localProject(name: string, files: ProjectFile[]): NormalizedProject { return { id: `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}`, name, framework: 'react-vite', files } }
