import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildCodexArgs, isConfirmedModel, normalizeArtifactPath, readRequiredArtifacts, stageRun } from '../src/local-api/codexCli'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })
describe('artifact-first Codex runtime', () => {
  it('requires a discovered explicit model', () => { expect(isConfirmedModel(['gpt-5.4-mini'], 'gpt-5.4-mini')).toBe(true); expect(isConfirmedModel(['gpt-5.4-mini'], 'automatic')).toBe(false); expect(isConfirmedModel([], undefined)).toBe(false) })
  it('normalizes safe snapshot-relative references', () => {
    const manifest = new Set(['python/learning/requirements.txt', 'src/main.ts'])
    expect(normalizeArtifactPath('source/python/learning/requirements.txt', manifest)).toBe('python/learning/requirements.txt')
    expect(normalizeArtifactPath('../source/python/learning/requirements.txt', manifest, { artifactRelative: true })).toBe('python/learning/requirements.txt')
    expect(normalizeArtifactPath('../../outside.txt', manifest, { artifactRelative: true })).toBeNull()
    expect(normalizeArtifactPath('./source/src\\main.ts', manifest)).toBe('src/main.ts')
    expect(normalizeArtifactPath('../outside.txt', manifest)).toBeNull()
    expect(normalizeArtifactPath('C:\\private.txt', manifest)).toBeNull()
  })
  it('builds the direct CLI invocation without a prompt sentinel', () => {
    const args = buildCodexArgs('C:/run', 'gpt-5.6-sol')
    expect(args).toContain('--json'); expect(args).toContain('--skip-git-repo-check'); expect(args).toContain('-C'); expect(args).toContain('C:/run'); expect(args).toContain('--model'); expect(args.at(-1)).toBe('gpt-5.6-sol'); expect(args).not.toContain('-'); expect(buildCodexArgs('C:/run')).not.toContain('--model')
  })
  it('stages a bounded source snapshot and accepts only required artifacts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'project-lens-')); directories.push(root)
    const run = await stageRun(root, 'run-1', [{ path: 'src/main.ts', content: 'export {}' }], '# skill')
    await writeFile(path.join(run.artifacts, 'overview.md'), '# Overview\n`src/main.ts`', 'utf8'); await writeFile(path.join(run.artifacts, 'complete-guide.md'), '# Guide\nRead `src/main.ts`.', 'utf8')
    await expect(readRequiredArtifacts(run.artifacts, new Set(['src/main.ts']))).resolves.toMatchObject({ 'overview.md': expect.stringContaining('Overview') })
    await expect(readFile(path.join(run.directory, 'source-manifest.json'), 'utf8')).resolves.toContain('src/main.ts')
  })
})
