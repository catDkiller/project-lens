export type AnalysisStatus = 'analysed' | 'inferred' | 'detected' | 'partial' | 'unsupported' | 'binary' | 'skipped' | 'generated' | 'uncertain'
export type ProjectItemType = 'source' | 'config' | 'style' | 'document' | 'data' | 'notebook' | 'asset' | 'binary' | 'generated' | 'other'

export interface ProjectItem {
  id: string
  path: string
  itemType: ProjectItemType
  purpose?: string
  technicalRole?: string
  references?: string[]
  relatedParts?: string[]
  analysisStatus: AnalysisStatus
  evidence?: string[]
  limitations?: string[]
  optionalPreview?: string
}

export interface ProjectPart {
  id: string
  name: string
  plainPurpose?: string
  canonicalTopics?: { name: string; explanation: string; whyItExists: string; evidenceFiles: string[] }[]
  summary?: string
  relevantFiles?: ProjectItem[]
  relationships?: string[]
  codeExamples?: { label: string; code: string }[]
  commandExamples?: { label: string; command: string }[]
  essentialDecisions?: { title: string; note: string }[]
  reviewItems?: { title: string; note: string }[]
  learningTopics?: { order: number; topic: string; reason: string }[]
  technicalEvidence?: { confidence: string; facts: string[] }[]
  analysisStatus: AnalysisStatus
  limitations?: string[]
}

export interface ProjectKnowledgeBase {
  id: string
  name: string
  sourceType: string
  category?: string
  summary?: string
  purpose?: string
  metadata?: { label: string; value: string }[]
  detectedLanguages?: string[]
  detectedFrameworks?: string[]
  technologies?: string[]
  projectParts?: ProjectPart[]
  importantFiles?: ProjectItem[]
  commands?: { command: string; description: string }[]
  decisions?: { title: string; note: string; status: 'review' | 'essential' }[]
  learningOrder?: { order: number; topic: string; reason: string; partId?: string }[]
  technicalEvidence?: string[]
  assets?: ProjectItem[]
  dataFiles?: ProjectItem[]
  notebooks?: ProjectItem[]
  documents?: ProjectItem[]
  models?: ProjectItem[]
  limitations?: string[]
  analysisCoverage?: { analysed: number; detected: number; skipped: number; unsupported: number }
  sourceFingerprint?: string
}
