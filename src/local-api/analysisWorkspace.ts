import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

export async function fileManifest(root: string): Promise<Map<string, string>> {
  const manifest = new Map<string, string>()
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile()) manifest.set(path.relative(root, file).replaceAll('\\', '/'), createHash('sha256').update(await readFile(file)).digest('hex'))
    }
  }
  await visit(root); return manifest
}

export async function createAnalysisWorkspace(source: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'project-lens-analysis-'))
  await cp(source, directory, { recursive: true })
  return { directory, before: await fileManifest(directory), id: randomUUID() }
}

export async function createProjectAnalysisWorkspace(files: { path: string; content: string }[]) {
  const source = await mkdtemp(path.join(tmpdir(), 'project-lens-source-'))
  for (const file of files) {
    const target = path.join(source, file.path)
    if (!target.startsWith(source + path.sep)) throw new Error('Unsafe project path.')
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.content, 'utf8')
  }
  const workspace = await createAnalysisWorkspace(source)
  return { ...workspace, source }
}

export function changedFiles(before: Map<string, string>, after: Map<string, string>) {
  return [...new Set([...before.keys(), ...after.keys()])].filter((file) => before.get(file) !== after.get(file)).sort()
}

export async function removeAnalysisWorkspace(directory: string, source?: string) { await rm(directory, { recursive: true, force: true, maxRetries: 3 }); if (typeof source === 'string') await rm(source, { recursive: true, force: true, maxRetries: 3 }) }
