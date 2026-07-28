import type { ImportRelationship, ProjectInventory } from './types'

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']
const importPattern = /(?:^|[;\n])\s*import\s+(?:[A-Za-z_$*{][\s\S]*?\s+from\s+)?["']([^"']+)["']/gm
const exportPattern = /(?:^|[;\n])\s*export\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/gm

export function buildImportGraph(inventory: ProjectInventory): ImportRelationship[] {
  const knownPaths = new Set(inventory.files.map((file) => file.path))

  return inventory.files
    .filter((file) => file.type === 'javascript' || file.type === 'typescript')
    .flatMap((file) => extractStaticImportSpecifiers(file.content).map((specifier) => {
      const kind = specifier.startsWith('.') ? 'relative' : 'package'
      const resolvedPath = kind === 'relative' ? resolveRelativeImport(file.path, specifier, knownPaths) : undefined

      return {
        fromPath: file.path,
        specifier,
        kind,
        resolution: kind === 'package' ? 'external' : resolvedPath ? 'resolved' : 'unresolved',
        ...(resolvedPath && { resolvedPath }),
      }
    }))
}

export function extractStaticImportSpecifiers(content: string): string[] {
  return [...content.matchAll(importPattern), ...content.matchAll(exportPattern)]
    .sort((left, right) => left.index - right.index)
    .map((match) => match[1])
}

function resolveRelativeImport(fromPath: string, specifier: string, knownPaths: Set<string>): string | undefined {
  const basePath = normalizeSegments([...fromPath.split('/').slice(0, -1), ...specifier.split('/')])
  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => `${basePath}/index${extension}`),
  ]

  return candidates.find((candidate) => knownPaths.has(candidate))
}

function normalizeSegments(segments: string[]): string {
  const normalized: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') normalized.pop()
    else normalized.push(segment)
  }

  return normalized.join('/')
}
