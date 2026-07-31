import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { changedFiles, createAnalysisWorkspace, fileManifest, removeAnalysisWorkspace } from '../src/local-api/analysisWorkspace'

const workspaces: string[] = []
afterEach(async () => { await Promise.all(workspaces.splice(0).map(removeAnalysisWorkspace)) })

describe('disposable analysis workspace', () => {
  it('copies the sample, detects mutations, and removes the copy', async () => {
    const source = await mkdtemp(path.join(tmpdir(), 'project-lens-source-')); workspaces.push(source)
    await writeFile(path.join(source, 'sample.ts'), 'export const value = 1')
    const workspace = await createAnalysisWorkspace(source); workspaces.push(workspace.directory)
    expect(workspace.directory).not.toBe(source)
    expect(await readFile(path.join(source, 'sample.ts'), 'utf8')).toContain('1')
    await writeFile(path.join(workspace.directory, 'sample.ts'), 'changed')
    expect(changedFiles(workspace.before, await fileManifest(workspace.directory))).toEqual(['sample.ts'])
    await removeAnalysisWorkspace(workspace.directory)
    expect(await import('node:fs/promises').then(({ access }) => access(workspace.directory).then(() => true, () => false))).toBe(false)
  })
})
