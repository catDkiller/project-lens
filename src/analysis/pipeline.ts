import { detectFeatures } from './features'
import { buildImportGraphAsync, extractStaticImportSpecifiers } from './imports'
import { createProjectInventoryAsync } from './inventory'
import type {
  FeatureDefinition,
  FeatureDetectionResult,
  ImportRelationship,
  ProjectInventory,
} from './types'
import type { NormalizedProject } from '../project-sources/types'

export const analysisStages = [
  { id: 'inventory', label: 'Inventory project files' },
  { id: 'imports', label: 'Extract imports' },
  { id: 'relationships', label: 'Build relationships' },
  { id: 'features', label: 'Detect project features' },
] as const

export type AnalysisStageId = (typeof analysisStages)[number]['id']
export type AnalysisStageStatus = 'pending' | 'running' | 'completed' | 'failed'
export interface AnalysisProgressDetail { current: number; total: number; area?: string }
export interface ProjectAnalysisOptions { signal?: AbortSignal; onProgress?: (stage: AnalysisStageId, detail: AnalysisProgressDetail) => void }

export interface ProjectAnalysis {
  project: NormalizedProject
  inventory: ProjectInventory
  importCount: number
  relationships: ImportRelationship[]
  features: FeatureDetectionResult[]
}

export async function runProjectAnalysis(
  project: NormalizedProject,
  definitions: FeatureDefinition[],
  reportStage: (id: AnalysisStageId, status: AnalysisStageStatus) => void,
  readableDelayMs = 0,
  options: ProjectAnalysisOptions = {},
): Promise<ProjectAnalysis> {
  let inventory: ProjectInventory | undefined
  let importCount = 0
  let relationships: ImportRelationship[] = []
  let features: FeatureDetectionResult[] = []

  await runStage('inventory', reportStage, readableDelayMs, async () => {
    inventory = await createProjectInventoryAsync(project, (detail) => options.onProgress?.('inventory', detail), options.signal)
  })
  await runStage('imports', reportStage, readableDelayMs, async () => {
    for (let start = 0; start < inventory!.files.length; start += 200) {
      if (options.signal?.aborted) throw new Error('Analysis was cancelled.')
      importCount += inventory!.files.slice(start, start + 200).reduce((count, file) => count + extractStaticImportSpecifiers(file.content).length, 0)
      const current = Math.min(start + 200, inventory!.files.length)
      options.onProgress?.('imports', { current, total: inventory!.files.length })
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  })
  await runStage('relationships', reportStage, readableDelayMs, async () => {
    relationships = await buildImportGraphAsync(inventory!, (detail) => options.onProgress?.('relationships', detail), options.signal)
  })
  await runStage('features', reportStage, readableDelayMs, () => {
    features = detectFeatures(inventory!, relationships, definitions)
  })

  return { project, inventory: inventory!, importCount, relationships, features }
}

async function runStage(
  id: AnalysisStageId,
  reportStage: (id: AnalysisStageId, status: AnalysisStageStatus) => void,
  readableDelayMs: number,
  run: () => void | Promise<void>,
): Promise<void> {
  reportStage(id, 'running')

  try {
    await run()
    reportStage(id, 'completed')
    if (readableDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, readableDelayMs))
  } catch (error) {
    reportStage(id, 'failed')
    throw error
  }
}
