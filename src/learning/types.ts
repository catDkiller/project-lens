export type ComplexityClassification = 'essential' | 'review-before-copy'

export interface LearningConcept {
  canonicalName: string
  plainExplanation: string
  whyItExists: string
  evidenceFiles: string[]
}

export interface ComplexityItem {
  title: string
  classification: ComplexityClassification
  explanation: string
  evidenceFiles: string[]
}

export interface LearningStep {
  order: number
  topic: string
  reason: string
}

export interface FeatureLearningPack {
  featureId: string
  summary: string
  concepts: LearningConcept[]
  complexityItems: ComplexityItem[]
  learningSteps: LearningStep[]
}
