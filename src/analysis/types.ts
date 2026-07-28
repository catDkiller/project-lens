export type InventoryFileType = 'javascript' | 'typescript' | 'stylesheet' | 'markup' | 'json' | 'other'

export interface InventoryFile {
  path: string
  content: string
  type: InventoryFileType
}

export interface ProjectInventory {
  files: InventoryFile[]
}

export interface ImportRelationship {
  fromPath: string
  specifier: string
  kind: 'relative' | 'package'
  resolution: 'resolved' | 'unresolved' | 'external'
  resolvedPath?: string
}

export interface FeatureEvidence {
  path: string
  fact: string
  weight: number
}

export interface RelevantFeatureFile {
  path: string
  score: number
  reasons: string[]
}

export interface FeatureDetectionResult {
  featureId: string
  label: string
  confidence: 'low' | 'medium' | 'high'
  relevantFiles: RelevantFeatureFile[]
  evidence: FeatureEvidence[]
}

export interface FeatureEvidenceRule {
  pattern: RegExp
  fact: string
  weight: number
}

export interface FeatureDefinition {
  id: string
  label: string
  filenameTokens: string[]
  routeRules?: FeatureEvidenceRule[]
  contentRules?: FeatureEvidenceRule[]
  importRules?: FeatureEvidenceRule[]
}
