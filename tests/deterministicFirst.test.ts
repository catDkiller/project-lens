import { describe, expect, it } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { buildPresentationKnowledgeBase, createProjectKnowledgeBase, parseCodexInsights, validatePresentationKnowledgeBase } from '../src/knowledge'
import { deriveLauncherState } from '../src/app/launcherState'
import type { NormalizedProject } from '../src/project-sources/types'

const project: NormalizedProject = { id: 'real-folder', name: 'Real folder', framework: 'Python', files: [{ path: 'pyproject.toml', content: '[project]\ndependencies=["requests"]' }, { path: 'app/main.py', content: 'import requests\nprint("hello")' }, { path: 'README.md', content: '# Real folder' }] }
async function knowledge() { return createProjectKnowledgeBase(await runProjectAnalysis(project, [], () => undefined), [], 'Selected folder') }

describe('deterministic-first selected folder flow', () => {
  it('opens a valid local workspace even when Codex is unavailable or signed out', async () => {
    const base = await knowledge(); const presentation = buildPresentationKnowledgeBase(base)
    expect(validatePresentationKnowledgeBase(presentation, base)).toEqual([])
    expect(presentation.projectName).toBe('Real folder')
    expect(presentation.sourceFingerprint).toBe(base.sourceFingerprint)
    expect(deriveLauncherState({ status: 'unavailable', error: 'No Codex', models: [] }, { kind: 'local', name: 'Real folder', support: 'supported' }, undefined).canAnalyse).toBe(false)
    expect(deriveLauncherState({ status: 'ready', models: ['gpt-5.4-mini'] }, { kind: 'local', name: 'Real folder', support: 'supported' }, 'gpt-5.4-mini').canAnalyse).toBe(true)
  })

  it('keeps deterministic identity and ignores Codex paths outside the active manifest', async () => {
    const base = await knowledge(); const parsed = parseCodexInsights({ summary: 'Verified summary', architecture: 'Verified architecture', importantFiles: [{ path: 'missing.py', explanation: 'Ignore this.' }] }, base)
    const presentation = buildPresentationKnowledgeBase(base, parsed.insights)
    expect(parsed.insights?.importantFiles).toEqual([])
    expect(presentation.sourceFingerprint).toBe(base.sourceFingerprint)
    expect(presentation.files?.every((file) => base.importantFiles?.some((known) => known.path === file.path))).toBe(true)
    expect(JSON.stringify(presentation)).not.toContain('prepared-sample-project')
  })
})
