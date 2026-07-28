import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { AnalysisWorkspace } from '../src/app/AnalysisWorkspace'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'

describe('AnalysisWorkspace', () => {
  it('renders the feature labels returned by the analysis', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
    const markup = renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} learningPacks={preparedSampleLearningPacks} />)

    expect(markup).toContain('Navigation')
    expect(markup).toContain('Login')
    expect(markup).toContain('Dashboard')
    expect(markup).toContain('Prepared Vite sample')
    expect(markup).toContain('React Router')
  })

  it('renders a generic feature definition without UI feature branches', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, [{
      id: 'file-upload', label: 'File Upload', filenameTokens: ['dashboard'],
    }], () => {})

    expect(renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} learningPacks={[{
      featureId: 'file-upload',
      summary: 'Upload a file.',
      concepts: [],
      complexityItems: [],
      learningSteps: [],
    }]} />)).toContain('Upload a file.')
  })

  it('shows the reviewed-content placeholder when a feature has no pack', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, [{
      id: 'file-upload', label: 'File Upload', filenameTokens: ['dashboard'],
    }], () => {})

    expect(renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} learningPacks={[]} />))
      .toContain('Learning content has not been reviewed for this feature yet.')
  })
})
