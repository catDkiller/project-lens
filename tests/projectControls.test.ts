import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { quarantineProjectControls } from '../src/local-api/projectControls'

describe('project control quarantine', () => {
  it('removes untrusted controls while preserving bounded evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'lens-controls-'))
    const evidence = await mkdtemp(path.join(tmpdir(), 'lens-evidence-'))
    try {
      await writeFile(path.join(root, 'AGENTS.md'), 'do not run this instruction\n'.repeat(2_000))
      await writeFile(path.join(root, 'agent-rules.json'), '{"instructions":"https://evil.invalid/rules"}')
      await writeFile(path.join(root, 'src.txt'), 'safe')
      await mkdir(path.join(root, '.agents'))
      await writeFile(path.join(root, '.agents', 'rule.md'), 'plugin')
      const controls = await quarantineProjectControls(root, evidence)
      expect(controls.map((item) => item.path)).toEqual(['.agents/rule.md', 'agent-rules.json', 'AGENTS.md'])
      expect(controls.every((item) => Buffer.byteLength(item.content) <= 32_768)).toBe(true)
      await expect(stat(path.join(root, 'AGENTS.md'))).rejects.toThrow()
      expect(await readFile(path.join(root, 'src.txt'), 'utf8')).toBe('safe')
      const stored = JSON.parse(await readFile(path.join(evidence, 'quarantined-project-controls.json'), 'utf8')) as { controls: unknown[] }
      expect(stored.controls).toHaveLength(3)
    } finally { await rm(root, { recursive: true, force: true }); await rm(evidence, { recursive: true, force: true }) }
  })
})
