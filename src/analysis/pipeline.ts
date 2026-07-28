import { detectFeatures } from './features'
import { buildImportGraph, extractStaticImportSpecifiers } from './imports'
import { createProjectInventory } from './inventory'
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
): Promise<ProjectAnalysis> {
  let inventory: ProjectInventory | undefined
  let importCount = 0
  let relationships: ImportRelationship[] = []
  let features: FeatureDetectionResult[] = []

  await runStage('inventory', reportStage, readableDelayMs, () => {
    inventory = createProjectInventory(project)
  })
  await runStage('imports', reportStage, readableDelayMs, () => {
    importCount = inventory!.files.reduce((count, file) => count + extractStaticImportSpecifiers(file.content).length, 0)
  })
  await runStage('relationships', reportStage, readableDelayMs, () => {
    relationships = buildImportGraph(inventory!)
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
  run: () => void,
): Promise<void> {
  reportStage(id, 'running')

  try {
    run()
    reportStage(id, 'completed')
    if (readableDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, readableDelayMs))
  } catch (error) {
    reportStage(id, 'failed')
    throw error
  }
}
