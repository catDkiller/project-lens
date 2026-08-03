import type { AnalysisStatus, ProjectItemType, ProjectSymbol } from './types'

export interface EvidenceReference {
  path: string
  fact?: string
}

export interface PresentationItem {
  id: string
  title: string
  explanation?: string
  whyItMatters?: string
  technicalName?: string
  relatedEvidence?: EvidenceReference[]
  analysisStatus?: AnalysisStatus
}

export interface PresentationSection {
  id: string
  title: string
  shortExplanation?: string
  items?: PresentationItem[]
  technicalName?: string
  relatedFiles?: string[]
  deeperExplanation?: string
  evidenceReferences?: EvidenceReference[]
  importRelationships?: string[]
  codeExamples?: { label: string; code: string }[]
}

export interface PresentationOverview {
  whatItIs?: string
  whatItDoes?: PresentationItem[]
  mainParts?: PresentationItem[]
  whereToStart?: PresentationItem[]
  usefulContext?: string
}

export interface PresentationFile {
  path: string
  title?: string
  explanation?: string
  itemType?: ProjectItemType
  technicalName?: string
  analysisStatus?: AnalysisStatus
  evidenceReferences?: EvidenceReference[]
  /** Readable local evidence only. Renderers must keep excerpts bounded. */
  preview?: string
}

export interface PresentationTechnology {
  name: string
  explanation?: string
  technicalName?: string
  evidenceReferences?: EvidenceReference[]
}

export interface PresentationProjectPart extends PresentationSection {
  id: string
  learningPath?: PresentationItem[]
  essentialComplexity?: PresentationItem[]
  reviewBeforeCopying?: PresentationItem[]
}

export interface PresentationKnowledgeBase {
  version: '1.0'
  sourceFingerprint?: string
  projectName: string
  projectTypeLabel?: string
  shortSummary?: string
  overview?: PresentationOverview
  sections?: PresentationSection[]
  projectParts?: PresentationProjectPart[]
  files?: PresentationFile[]
  technologies?: PresentationTechnology[]
  learningPath?: PresentationItem[]
  limitations?: PresentationSection
  technicalReference?: PresentationSection[]
  /** Confirmed static file edges only; these are not function-call edges. */
  relationships?: { fromPath: string; toPath: string; type: 'imports'; status: 'analysed' }[]
  symbols?: ProjectSymbol[]
  overviewMarkdown?: string
  completeGuideMarkdown?: string
}
