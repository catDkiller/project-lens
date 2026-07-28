import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { App } from '../src/app/App'
import { AnalysisProgress } from '../src/app/AnalysisProgress'
import { AnalysisWorkspace } from '../src/app/AnalysisWorkspace'
import { createSearchResults } from '../src/app/workspaceSearch'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'

async function preparedAnalysis() {
  return runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
}

describe('project knowledge workspace', () => {
  it('renders the minimal start flow', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('Project Lens')
    expect(markup).toContain('Try prepared sample')
    expect(markup).toContain('Open local project — coming soon')
    expect(markup).not.toContain('Choose a source')
  })

  it('renders generic project-part navigation after analysis completion', async () => {
    const analysis = await preparedAnalysis()
    const markup = renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} learningPacks={preparedSampleLearningPacks} onRestart={vi.fn()} />)
    expect(markup).toContain('Overview')
    expect(markup).toContain('Project parts')
    expect(markup).toContain('Navigation')
    expect(markup).toContain('View technical evidence')
  })

  it('keeps analysis stages inside a disclosure', () => {
    const markup = renderToStaticMarkup(<AnalysisProgress stages={{ inventory: 'completed', imports: 'completed', relationships: 'completed', features: 'completed' }} />)
    expect(markup).toContain('Analysing project…')
    expect(markup).toContain('<details>')
    expect(markup).toContain('Analysis details')
  })

  it('searches deterministically across project knowledge and provides destinations', async () => {
    const analysis = await preparedAnalysis()
    expect(createSearchResults(analysis, preparedSampleLearningPacks, 'router')).toEqual(createSearchResults(analysis, preparedSampleLearningPacks, 'router'))
    expect(createSearchResults(analysis, preparedSampleLearningPacks, 'router')).toContainEqual({ id: 'concept:navigation:React Router', title: 'React Router', detail: 'Navigation', section: 'learning', featureId: 'navigation' })
    expect(createSearchResults(analysis, preparedSampleLearningPacks, 'metriccard')).toContainEqual({ id: 'file:src/components/MetricCard.tsx', title: 'src/components/MetricCard.tsx', detail: 'Project file', section: 'files', filePath: 'src/components/MetricCard.tsx' })
  })

  it('renders a generic project part without feature-name branches', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, [{ id: 'file-upload', label: 'File Upload', filenameTokens: ['dashboard'] }], () => {})
    expect(renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} learningPacks={[]} onRestart={vi.fn()} />)).toContain('File Upload')
  })
})
