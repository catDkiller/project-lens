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
