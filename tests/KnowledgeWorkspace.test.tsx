import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { App } from '../src/app/App'
import { KnowledgeWorkspace } from '../src/app/KnowledgeWorkspace'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { createProjectKnowledgeBase } from '../src/knowledge'
import type { ProjectKnowledgeBase } from '../src/knowledge'

async function sampleKnowledge() {
  const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
  return createProjectKnowledgeBase(analysis, preparedSampleLearningPacks)
}

describe('open-design knowledge workspace', () => {
  it('keeps the launcher and workspace mutually exclusive', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('Try sample project')
    expect(markup).not.toContain('Open another project')
  })

  it('adapts deterministic analysis into the overview data', async () => {
    const knowledge = await sampleKnowledge()
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={knowledge} appearance="light" accent="blue" onAppearance={vi.fn()} onAccent={vi.fn()} onReturn={vi.fn()} onReanalyse={vi.fn()} />)
    expect(knowledge.projectParts?.map((part) => part.name)).toEqual(['Navigation', 'Login', 'Dashboard'])
    expect(markup).toContain('9 analysed files')
    expect(markup).toContain('Complete Guide')
  })

  it('renders a non-web knowledge base without empty optional navigation', () => {
    const knowledge: ProjectKnowledgeBase = { id: 'research', name: 'Climate notes', sourceType: 'Local', category: 'research project', summary: 'A partially inspected research repository.', importantFiles: [{ id: 'notes.ipynb', path: 'notes.ipynb', itemType: 'notebook', analysisStatus: 'partial', limitations: ['Notebook cells were not inspected.'] }], limitations: ['Notebook content is partially supported.'] }
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={knowledge} appearance="dark" accent="violet" onAppearance={vi.fn()} onAccent={vi.fn()} onReturn={vi.fn()} onReanalyse={vi.fn()} />)
    expect(markup).toContain('Climate notes')
    expect(markup).toContain('Analysis limitations')
    expect(markup).not.toContain('Commands</button>')
  })

  it('keeps sample-only agent data outside reusable components', async () => {
    const knowledge = await sampleKnowledge()
    expect(knowledge.name).toBe(preparedViteSample.name)
    expect(renderToStaticMarkup(<KnowledgeWorkspace knowledge={knowledge} appearance="light" accent="emerald" onAppearance={vi.fn()} onAccent={vi.fn()} onReturn={vi.fn()} onReanalyse={vi.fn()} />)).not.toContain('Codex (sample configuration)')
  })
})
