import { describe, expect, it } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedSamplePresentationKnowledge } from '../src/fixtures/preparedSamplePresentationKnowledge'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { createProjectExplanationRequest, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../src/knowledge'

async function sampleKnowledge() {
  const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
  return createProjectKnowledgeBase(analysis, preparedSampleLearningPacks)
}

describe('presentation validation', () => {
  it('rejects invalid agent output instead of exposing it', async () => {
    const invalid = { ...preparedSamplePresentationKnowledge, sections: [{ id: 'bad', title: '', shortExplanation: '<script>alert(1)</script>', relatedFiles: ['src/not-real.ts'] }] }
    expect(validatePresentationKnowledgeBase(invalid, await sampleKnowledge())).toEqual(['section: invalid heading bad', 'bad: invalid text', 'bad: unknown file src/not-real.ts'])
  })

  it('rejects malformed output without throwing', async () => {
    expect(validatePresentationKnowledgeBase({ projectName: 42 }, await sampleKnowledge())).toEqual(['presentation: malformed output'])
  })

  it('rejects malformed code blocks', async () => {
    const invalid = { ...preparedSamplePresentationKnowledge, projectParts: [{ ...preparedSamplePresentationKnowledge.projectParts![0], codeExamples: [{ label: 'src/App.tsx', code: '```tsx\nexample\n```' }] }] }
    expect(validatePresentationKnowledgeBase(invalid, await sampleKnowledge())).toContain('navigation: invalid code example')
  })

  it('limits overview content to the intended concise range in the sample', () => {
    expect(preparedSamplePresentationKnowledge.overview?.mainParts).toHaveLength(3)
    expect(preparedSamplePresentationKnowledge.overview?.whereToStart).toHaveLength(3)
  })

  it('builds a versioned, provider-independent explanation request', async () => {
    const request = createProjectExplanationRequest(await sampleKnowledge())
    expect(request.promptVersion).toBe('1.0')
    expect(request.rawKnowledge.name).toBe('Prepared Vite sample')
    expect(request.unsupportedContent).toContain('Static import analysis currently supports JavaScript, JSX, TypeScript, and TSX. Dynamic imports, aliases, and package internals are not inspected.')
  })
})
