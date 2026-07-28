export { buildImportGraph, extractStaticImportSpecifiers } from './imports'
export { detectFeatures } from './features'
export { createProjectInventory } from './inventory'
export { analysisStages, runProjectAnalysis } from './pipeline'
export type { AnalysisStageId, AnalysisStageStatus, ProjectAnalysis } from './pipeline'
export type {
  FeatureDetectionResult,
  FeatureDefinition,
  FeatureEvidence,
  ImportRelationship,
  InventoryFile,
  ProjectInventory,
  RelevantFeatureFile,
} from './types'
