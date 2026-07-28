import { describe, expect, it } from 'vitest'
import { analysisStages, runProjectAnalysis } from '../src/analysis'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'

describe('runProjectAnalysis', () => {
  it('runs the prepared sample pipeline in deterministic stage order', async () => {
    const completed: string[] = []
    const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, (id, status) => {
      if (status === 'completed') completed.push(id)
    })

    expect(completed).toEqual(analysisStages.map((stage) => stage.id))
    expect(analysis.features.map((feature) => feature.label)).toEqual(['Navigation', 'Login', 'Dashboard'])
    expect(analysis.inventory.files).toHaveLength(9)
  })

  it('reports a failed stage when feature detection cannot run', async () => {
    const updates: string[] = []

    await expect(runProjectAnalysis(preparedViteSample, null as unknown as [], (id, status) => {
      updates.push(`${id}:${status}`)
    })).rejects.toThrow()

    expect(updates).toContain('features:failed')
  })
})
