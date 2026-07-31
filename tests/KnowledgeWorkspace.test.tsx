import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { App } from '../src/app/App'
import { KnowledgeWorkspace } from '../src/app/KnowledgeWorkspace'
import { Launcher } from '../src/app/Launcher'
import { ThemeMenu } from '../src/app/ThemeMenu'
import { AnalysisProgress } from '../src/app/AnalysisProgress'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedSamplePresentationKnowledge } from '../src/fixtures/preparedSamplePresentationKnowledge'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { createPresentationFallback, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../src/knowledge'
import type { PresentationKnowledgeBase } from '../src/knowledge'

const workspaceProps = { appearance: 'light' as const, accent: 'blue' as const, onAppearance: vi.fn(), onAccent: vi.fn(), onReturn: vi.fn(), onReanalyse: vi.fn() }

async function rawKnowledge() {
  const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
  return createProjectKnowledgeBase(analysis, preparedSampleLearningPacks)
}

describe('presentation knowledge workspace', () => {
  it('keeps the launcher and workspace mutually exclusive', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('Use prepared sample')
    expect(markup).not.toContain('Open another project')
  })

  it('shows the current deterministic analysis stage while the sample is running', () => {
    const markup = renderToStaticMarkup(<Launcher models={[]} isAnalysing analysisStage="features" appearance="dark" accent="blue" onAppearance={vi.fn()} onAccent={vi.fn()} onTrySample={vi.fn()} onUsePrepared={vi.fn()} onCancel={vi.fn()} />)
    expect(markup).toContain('Checking features…')
  })

  it('uses presentation language instead of raw analyser descriptions', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={preparedSamplePresentationKnowledge} {...workspaceProps} />)
    expect(markup).toContain('A small web application with a sign-in screen')
    expect(markup).not.toContain('Analysed project file.')
    expect(markup).not.toContain('Static imports')
  })

  it('keeps technical evidence available in disclosures', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={preparedSamplePresentationKnowledge} {...workspaceProps} />)
    expect(markup).toContain('View technical evidence')
    expect(markup).toContain('View analysis notes')
    expect(markup).toContain('Dynamic imports, aliases, and package internals are not inspected.')
  })

  it('keeps the guide navigable and marks the current section', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={preparedSamplePresentationKnowledge} {...workspaceProps} />)
    expect(markup).toContain('aria-current="page"')
    expect(renderToStaticMarkup(<KnowledgeWorkspace knowledge={{ ...preparedSamplePresentationKnowledge, projectParts: undefined, files: undefined, technicalReference: undefined } } {...workspaceProps} />)).not.toContain('guide-parts')
  })

  it('uses human-oriented result navigation and stable project search', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={preparedSamplePresentationKnowledge} {...workspaceProps} />)
    expect(markup).toContain('Guide</button>')
    expect(markup).toContain('Explore</button>')
    expect(markup).toContain('Review</button>')
    expect(markup).not.toContain('Technologies</button>')
  })

  it('renders factual analysis progress as a live status with activity history', () => {
    const markup = renderToStaticMarkup(<AnalysisProgress projectName="python-project" modelId="provider/model" events={[{ type: 'queued', message: 'Prepared files', timestamp: '2026-07-31T10:00:00.000Z' }, { type: 'analysing', message: 'Mapped the project structure' }]} onCancel={vi.fn()} />)
    expect(markup).toContain('Understanding “python-project”')
    expect(markup).toContain('Mapped the project structure')
    expect(markup).toContain('role="log"')
    expect(markup).not.toContain('%')
  })

  it('shows elapsed and stalled status from event timestamps without inventing progress', () => {
    const markup = renderToStaticMarkup(<AnalysisProgress projectName="python-project" startedAt={Date.now() - 40_000} modelId="provider/model" events={[{ type: 'analysing', message: 'Inspecting src/app.ts', timestamp: new Date(Date.now() - 40_000).toISOString() }]} onCancel={vi.fn()} />)
    expect(markup).toContain('Elapsed:')
    expect(markup).toContain('Still waiting for the selected provider')
    expect(markup).not.toContain('%')
  })

  it('keeps provider-authentication failure specific and exposes a connection action', () => {
    const markup = renderToStaticMarkup(<AnalysisProgress modelId="opencode/deepseek-v4-flash-free" failed="OpenCode is not connected" events={[{ type: 'failed', message: 'Connect OpenCode to use this model.', diagnostic: { code: 'provider-authentication-required', modelId: 'opencode/deepseek-v4-flash-free' } }]} onCancel={vi.fn()} onConnectOpenCode={vi.fn()} />)
    expect(markup).toContain('needs an authenticated OpenCode provider')
    expect(markup).toContain('Connect through OpenCode')
    expect(markup).toContain('Activity details')
  })


  it('keeps plain titles and technical names separate', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={preparedSamplePresentationKnowledge} {...workspaceProps} />)
    expect(markup).toContain('Moving between screens')
    expect(markup).toContain('Technical name: react-router-dom')
  })

  it('renders a non-web presentation without web assumptions', () => {
    const knowledge: PresentationKnowledgeBase = { version: '1.0', projectName: 'Climate notes', projectTypeLabel: 'Research project', shortSummary: 'A partially inspected research repository.', overview: { whatItIs: 'A collection of climate research notes.' }, files: [{ path: 'notes.ipynb', explanation: 'The file was found, but its exact role could not be confirmed.', itemType: 'notebook', analysisStatus: 'partial' }], limitations: { id: 'notes', title: 'Analysis notes', items: [{ id: 'cells', title: 'Notebook cells', explanation: 'Notebook cells were not inspected.' }] } }
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={knowledge} appearance="dark" accent="violet" onAppearance={vi.fn()} onAccent={vi.fn()} onReturn={vi.fn()} onReanalyse={vi.fn()} />)
    expect(markup).toContain('Climate notes')
    expect(markup).toContain('Research project')
    expect(markup).not.toContain('React Router')
  })

  it('keeps sample-only language out of reusable components', async () => {
    const workspaceSource = await import('../src/app/KnowledgeWorkspace?raw')
    expect(workspaceSource.default).not.toContain('Prepared Vite sample')
    expect(workspaceSource.default).not.toContain('sign-in screen')
    expect(workspaceSource.default).toContain('View import relationships')
    expect(workspaceSource.default).toContain('View code excerpt')
  })

  it('marks the selected appearance and accent in the theme control', () => {
    const markup = renderToStaticMarkup(<ThemeMenu appearance="dark" accent="rose" onAppearance={vi.fn()} onAccent={vi.fn()} />)
    expect(markup).toContain('aria-pressed="true" type="button">dark')
    expect(markup).toContain('aria-pressed="true" type="button"><span class="swatch rose"')
  })

  it('validates the prepared presentation against real analysis evidence', async () => {
    expect(validatePresentationKnowledgeBase(preparedSamplePresentationKnowledge, await rawKnowledge())).toEqual([])
  })

  it('uses an honest deterministic fallback when presentation data is unavailable', async () => {
    const fallback = createPresentationFallback(await rawKnowledge())
    expect(fallback.files?.find((file) => file.path === 'src/utils/formatDate.ts')?.explanation).toBe('The file was found, but its exact role could not be confirmed.')
  })
})
