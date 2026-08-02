import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readArtifact } from '../src/local-api/artifacts'

const directories: string[] = []
async function artifact(bytes: Buffer) { const directory = await mkdtemp(path.join(tmpdir(), 'project-lens-artifact-')); directories.push(directory); await mkdir(path.join(directory, 'artifacts')); await writeFile(path.join(directory, 'artifacts', 'overview.md'), bytes); return directory }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('artifact reader', () => {
  it('accepts Unicode UTF-8 and extracts only Markdown links and inline-code references', async () => {
    const directory = await artifact(Buffer.from('# Overview — \ud83d\ude80\n[main](../source/src/main.ts)\n`src/app.ts`\n```\nnot/a/reference.ts\n```', 'utf8'))
    await expect(readArtifact(path.join(directory, 'artifacts'), 'overview.md', new Set(['src/main.ts', 'src/app.ts']))).resolves.toMatchObject({ references: [{ kind: 'source-file', normalized: 'src/main.ts' }, { kind: 'source-file', normalized: 'src/app.ts' }] })
  })
  it('accepts UTF-16LE BOM and rejects unsafe controls', async () => {
    const valid = await artifact(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# Guide', 'utf16le')]))
    await expect(readArtifact(path.join(valid, 'artifacts'), 'overview.md', new Set())).resolves.toMatchObject({ text: '# Guide' })
    const invalid = await artifact(Buffer.from('# Guide\u0000', 'utf8'))
    await expect(readArtifact(path.join(invalid, 'artifacts'), 'overview.md', new Set())).rejects.toThrow('artifact-control-characters')
  })
})
