import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

export type ArtifactReferenceKind = 'source-file' | 'runtime-generated' | 'external' | 'anchor' | 'unverified' | 'invalid'
export type ArtifactReference = { kind: ArtifactReferenceKind; reference: string; normalized?: string; evidence?: string }
export type ArtifactFinding = { artifact: string; code: string; message: string }
export type ArtifactRead = { text: string; references: ArtifactReference[]; hash: string }

const MAX_ARTIFACT_BYTES = 100_000
const hasUnsafeControl = (value: string) => [...value].some((character) => { const code = character.charCodeAt(0); return code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13) })

export function normalizeArtifactPath(value: string, manifestPaths: Iterable<string>, options: { artifactRelative?: boolean } = {}): string | null {
  let cleaned = value.trim().replace(/^[`'"([<{]+|[`'">)}.,;:!?]+$/g, '').replaceAll('\\', '/').replace(/\/{2,}/g, '/')
  if (options.artifactRelative && /^\.\.\/source\//i.test(cleaned)) cleaned = cleaned.replace(/^\.\.\/source\//i, '')
  else cleaned = cleaned.replace(/^\.\//, '').replace(/^source\//i, '')
  if (!cleaned || hasUnsafeControl(cleaned) || cleaned.startsWith('/') || cleaned.startsWith('//') || /^[a-z]:\//i.test(cleaned) || cleaned.split('/').some((part) => part === '..')) return null
  const target = cleaned.split('/').filter((part) => part && part !== '.').join('/')
  const paths = [...manifestPaths]
  const same = (candidate: string) => process.platform === 'win32' ? candidate.toLowerCase() === target.toLowerCase() : candidate === target
  const exact = paths.find(same)
  if (exact) return exact
  const directory = paths.some((candidate) => process.platform === 'win32' ? candidate.toLowerCase().startsWith(`${target.toLowerCase()}/`) : candidate.startsWith(`${target}/`))
  if (directory) return target
  const suffixes = paths.filter((candidate) => process.platform === 'win32' ? candidate.toLowerCase().endsWith(`/${target.toLowerCase()}`) : candidate.endsWith(`/${target}`))
  return suffixes.length === 1 ? suffixes[0] : null
}

export function classifyArtifactReference(reference: string, context: string, manifestPaths: Iterable<string>, options: { artifactRelative?: boolean } = {}): ArtifactReference {
  const value = reference.trim()
  if (!value) return { kind: 'invalid', reference }
  if (value.startsWith('#')) return { kind: 'anchor', reference: value }
  if (/^(https?:|mailto:|git@|npm:)/i.test(value)) return { kind: 'external', reference: value }
  const normalized = normalizeArtifactPath(value, manifestPaths, options)
  if (normalized) return { kind: 'source-file', reference: value, normalized }
  if (/^(models|output|logs|\.cache|cache|skill|artifacts)\//i.test(value.replaceAll('\\', '/')) || /\.(task|log)$/i.test(value)) return { kind: 'runtime-generated', reference: value, normalized: value.replaceAll('\\', '/').replace(/^\.?(\/)?source\//i, ''), evidence: context.slice(0, 240) }
  return { kind: 'unverified', reference: value.replaceAll('\\', '/') }
}

function decode(bytes: Buffer): string {
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error('artifact-too-large')
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(bytes.byteLength - 2)
    for (let index = 2; index < bytes.byteLength; index += 2) { swapped[index - 2] = bytes[index + 1] ?? 0; swapped[index - 1] = bytes[index] }
    return new TextDecoder('utf-16le', { fatal: true }).decode(swapped)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0))
}

function markdownReferences(text: string, manifestPaths: Iterable<string>): ArtifactReference[] {
  const tree = unified().use(remarkParse).parse(text) as { children?: Array<{ type?: string; url?: string; value?: string }> }
  const references: ArtifactReference[] = []
  const visit = (node: { type?: string; url?: string; value?: string; children?: typeof tree.children }) => {
    if (node.type === 'link' && typeof node.url === 'string') references.push(classifyArtifactReference(node.url, node.value ?? node.url, manifestPaths, { artifactRelative: true }))
    if (node.type === 'inlineCode' && typeof node.value === 'string' && /[\\/]/.test(node.value)) references.push(classifyArtifactReference(node.value, node.value, manifestPaths))
    node.children?.forEach(visit)
  }
  tree.children?.forEach(visit)
  return references
}

export async function readArtifact(artifactsDirectory: string, name: string, manifestPaths: Iterable<string>): Promise<ArtifactRead> {
  const root = path.resolve(artifactsDirectory)
  const target = path.resolve(root, name)
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('artifact-path-escape')
  const info = await lstat(target).catch(() => undefined)
  if (!info) throw new Error('artifact-missing')
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('artifact-not-regular-file')
  let text: string
  try { text = decode(await readFile(target)) } catch (error) { throw new Error(error instanceof Error && error.message.startsWith('artifact-') ? error.message : 'artifact-unsupported-encoding') }
  if (!text.trim()) throw new Error('artifact-empty')
  if (hasUnsafeControl(text)) throw new Error('artifact-control-characters')
  if (/this is a prepared[- ]sample project|fixture project used for demonstration/i.test(text)) throw new Error('artifact-fixture-claim')
  const references = markdownReferences(text, manifestPaths)
  const invalid = references.find((reference) => reference.kind === 'invalid')
  if (invalid) throw new Error(`artifact-invalid-reference:${invalid.reference}`)
  const { createHash } = await import('node:crypto')
  return { text, references, hash: createHash('sha256').update(text).digest('hex') }
}

export async function readRequiredArtifacts(artifactsDirectory: string, sourcePaths: Set<string>) {
  const entries = await Promise.all((['overview.md', 'complete-guide.md'] as const).map(async (name) => [name, await readArtifact(artifactsDirectory, name, sourcePaths)] as const))
  return Object.fromEntries(entries.map(([name, value]) => [name, value.text])) as Record<'overview.md' | 'complete-guide.md', string>
}
