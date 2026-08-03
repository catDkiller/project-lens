import type { NormalizedProject, ProjectFile } from '../project-sources/types'
import type { InventoryFileType, ProjectInventory } from './types'

const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.git'])
const binaryExtensions = new Set([
  '.avif', '.bmp', '.exe', '.gif', '.ico', '.jpeg', '.jpg', '.mov', '.mp3', '.mp4', '.pdf', '.png',
  '.ttf', '.wav', '.webm', '.woff', '.woff2', '.zip',
])

export function createProjectInventory(project: NormalizedProject): ProjectInventory {
  const files = project.files
    .map((file) => ({ ...file, path: normalizeProjectPath(file.path) }))
    .filter(isRelevantFile)
    .map((file) => ({ ...file, type: classifyFileType(file.path) }))
    .sort((left, right) => left.path.localeCompare(right.path))

  return { files }
}

export async function createProjectInventoryAsync(
  project: NormalizedProject,
  onProgress?: (progress: { current: number; total: number; area?: string }) => void,
  signal?: AbortSignal,
): Promise<ProjectInventory> {
  const files: ReturnType<typeof createProjectInventory>['files'] = []
  const chunkSize = 200
  for (let start = 0; start < project.files.length; start += chunkSize) {
    if (signal?.aborted) throw new Error('Analysis was cancelled.')
    for (const file of project.files.slice(start, start + chunkSize)) {
      const normalized = { ...file, path: normalizeProjectPath(file.path) }
      if (isRelevantFile(normalized)) files.push({ ...normalized, type: classifyFileType(normalized.path) })
    }
    const current = Math.min(start + chunkSize, project.files.length)
    onProgress?.({ current, total: project.files.length, area: project.files[Math.max(0, current - 1)]?.path.split('/').slice(0, -1).join('/') || undefined })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  return { files }
}

export function normalizeProjectPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function isRelevantFile(file: ProjectFile): boolean {
  const path = normalizeProjectPath(file.path)
  const filename = path.split('/').at(-1) ?? ''
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase()

  return !path.split('/').some((segment) => ignoredDirectories.has(segment))
    && !binaryExtensions.has(extension)
    && !filename.endsWith('.map')
    && !filename.endsWith('.min.js')
    && !['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(filename)
}

function classifyFileType(path: string): InventoryFileType {
  if (/\.(js|jsx)$/i.test(path)) return 'javascript'
  if (/\.(ts|tsx)$/i.test(path)) return 'typescript'
  if (/\.css$/i.test(path)) return 'stylesheet'
  if (/\.html$/i.test(path)) return 'markup'
  if (/\.json$/i.test(path)) return 'json'
  return 'other'
}
