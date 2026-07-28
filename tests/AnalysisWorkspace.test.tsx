import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { AnalysisWorkspace } from '../src/app/AnalysisWorkspace'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'

describe('AnalysisWorkspace', () => {
  it('renders the feature labels returned by the analysis', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
    const markup = renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} />)

    expect(markup).toContain('Navigation')
    expect(markup).toContain('Login')
    expect(markup).toContain('Dashboard')
    expect(markup).toContain('Prepared Vite sample')
  })

  it('renders a generic feature definition without UI feature branches', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, [{
      id: 'file-upload', label: 'File Upload', filenameTokens: ['dashboard'],
    }], () => {})

    expect(renderToStaticMarkup(<AnalysisWorkspace analysis={analysis} />)).toContain('File Upload')
  })
})
