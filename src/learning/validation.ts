import type { NormalizedProject } from '../project-sources/types'
import type { ComplexityClassification, FeatureLearningPack } from './types'

const validClassifications: ComplexityClassification[] = ['essential', 'review-before-copy']

export function findLearningPack(featureId: string, packs: FeatureLearningPack[]) {
  return packs.find((pack) => pack.featureId === featureId)
}

export function validateLearningPacks(packs: FeatureLearningPack[], project: NormalizedProject) {
  const knownPaths = new Set(project.files.map((file) => file.path.replaceAll('\\', '/')))
  const issues: string[] = []

  for (const pack of packs) {
    const evidenceFiles = [...pack.concepts.flatMap((concept) => concept.evidenceFiles), ...pack.complexityItems.flatMap((item) => item.evidenceFiles)]

    for (const path of evidenceFiles) {
      if (!knownPaths.has(path)) issues.push(`${pack.featureId}: missing evidence file ${path}`)
    }

    if (!pack.learningSteps.every((step, index) => step.order === index + 1)) {
      issues.push(`${pack.featureId}: learning steps must start at 1 and increase by one`)
    }

    if (!pack.complexityItems.every((item) => validClassifications.includes(item.classification))) {
      issues.push(`${pack.featureId}: invalid complexity classification`)
    }
  }

  return issues
}
