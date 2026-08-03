import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readRequiredArtifacts, runCodexCli, stageRun } from '../src/local-api/codexCli'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('controlled Codex process boundary', () => {
  it('streams JSONL while the child writes validated artifacts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'project-lens-controlled-'))
    directories.push(root)
    const staged = await stageRun(root, 'fixture-run', [{ path: 'src/main.ts', content: 'export {}' }], '# skill')
    const events: string[] = []
    const result = await runCodexCli({
      executable: process.execPath,
      args: [path.resolve('tests/fixtures/controlled-codex.mjs')],
      cwd: staged.directory,
      prompt: 'fixture',
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event.type),
    })
    expect(result.code).toBe(0)
    expect(events).toEqual(expect.arrayContaining(['thread_started', 'status', 'file_write', 'process_exited']))
    await expect(readRequiredArtifacts(staged.artifacts, new Set(['src/main.ts']))).resolves.toMatchObject({ 'overview.md': expect.stringContaining('Controlled overview') })
  })
})
