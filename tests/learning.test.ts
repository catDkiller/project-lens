import { describe, expect, it } from 'vitest'
import { findLearningPack, validateLearningPacks } from '../src/learning'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { runProjectAnalysis } from '../src/analysis'

describe('prepared sample learning packs', () => {
  it('matches every detected prepared-sample feature', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})

    expect(analysis.features.map((feature) => findLearningPack(feature.featureId, preparedSampleLearningPacks)?.featureId))
      .toEqual(analysis.features.map((feature) => feature.featureId))
  })

  it('references fixture files and uses valid step order and complexity classifications', () => {
    expect(validateLearningPacks(preparedSampleLearningPacks, preparedViteSample)).toEqual([])
  })

  it('reports invalid evidence, step order, and classifications', () => {
    const invalidPack = [{
      featureId: 'example',
      summary: 'Example.',
      concepts: [{ canonicalName: 'Example', plainExplanation: 'Example.', whyItExists: 'Example.', evidenceFiles: ['src/missing.ts'] }],
      complexityItems: [{ title: 'Example', classification: 'not-valid' as 'essential', explanation: 'Example.', evidenceFiles: [] }],
      learningSteps: [{ order: 2, topic: 'Example', reason: 'Example.' }],
    }]

    expect(validateLearningPacks(invalidPack, preparedViteSample)).toEqual([
      'example: missing evidence file src/missing.ts',
      'example: learning steps must start at 1 and increase by one',
      'example: invalid complexity classification',
    ])
  })
})
