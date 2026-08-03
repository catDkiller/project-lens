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

  it('yields during inventory and reports bounded progress', async () => {
    const project = { ...preparedViteSample, files: Array.from({ length: 450 }, (_, index) => ({ path: `src/file-${index}.ts`, content: 'export const value = 1' })) }
    const progress: Array<{ stage: string; current: number; total: number }> = []
    await runProjectAnalysis(project, [], () => undefined, 0, { onProgress: (stage, detail) => progress.push({ stage, current: detail.current, total: detail.total }) })
    expect(progress.some((item) => item.stage === 'inventory' && item.current < item.total)).toBe(true)
    expect(progress.every((item) => item.current <= item.total && item.current >= 0)).toBe(true)
    expect(progress.some((item) => item.stage === 'imports')).toBe(true)
  })

  it('finalizes empty and sub-chunk projects without waiting for a full batch', async () => {
    for (const count of [0, 1, 199, 200, 201]) {
      const progress: Array<{ stage: string; current: number; total: number }> = []
      const project = { ...preparedViteSample, files: Array.from({ length: count }, (_, index) => ({ path: `src/file-${index}.ts`, content: 'export const value = 1' })) }
      const result = await runProjectAnalysis(project, [], () => undefined, 0, { onProgress: (stage, detail) => progress.push({ stage, current: detail.current, total: detail.total }) })
      expect(result.inventory.files).toHaveLength(count)
      expect(progress.some((item) => item.stage === 'imports' && item.current === 0)).toBe(true)
      expect(progress.some((item) => item.stage === 'relationships' && item.current === 0)).toBe(true)
    }
  })

  it('does not activate cancellation unless the caller aborts', async () => {
    const controller = new AbortController()
    await expect(runProjectAnalysis(preparedViteSample, [], () => undefined, 0, { signal: controller.signal })).resolves.toBeDefined()
    expect(controller.signal.aborted).toBe(false)
  })
})
