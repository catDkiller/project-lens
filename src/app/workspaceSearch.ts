import type { ProjectAnalysis } from '../analysis'
import type { FeatureLearningPack } from '../learning'

export type WorkspaceSection = 'overview' | 'project-parts' | 'learning' | 'review' | 'files'

export interface SearchResult {
  id: string
  title: string
  detail: string
  section: WorkspaceSection
  featureId?: string
  filePath?: string
}

function matches(query: string, ...values: string[]) {
  return values.join(' ').toLowerCase().includes(query)
}

export function createSearchResults(analysis: ProjectAnalysis, packs: FeatureLearningPack[], query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const results: SearchResult[] = []
  const packsByFeatureId = new Map(packs.map((pack) => [pack.featureId, pack]))

  for (const feature of analysis.features) {
    const pack = packsByFeatureId.get(feature.featureId)
    if (matches(term, feature.label)) results.push({ id: `feature:${feature.featureId}`, title: feature.label, detail: 'Project part', section: 'project-parts', featureId: feature.featureId })
    for (const file of feature.relevantFiles) if (matches(term, file.path)) results.push({ id: `part-file:${feature.featureId}:${file.path}`, title: file.path, detail: feature.label, section: 'project-parts', featureId: feature.featureId, filePath: file.path })
    for (const concept of pack?.concepts ?? []) if (matches(term, concept.canonicalName)) results.push({ id: `concept:${feature.featureId}:${concept.canonicalName}`, title: concept.canonicalName, detail: feature.label, section: 'learning', featureId: feature.featureId })
    for (const step of pack?.learningSteps ?? []) if (matches(term, step.topic)) results.push({ id: `step:${feature.featureId}:${step.order}`, title: step.topic, detail: feature.label, section: 'learning', featureId: feature.featureId })
    for (const item of pack?.complexityItems ?? []) if (matches(term, item.title, item.explanation)) results.push({ id: `complexity:${feature.featureId}:${item.title}`, title: item.title, detail: feature.label, section: item.classification === 'essential' ? 'project-parts' : 'review', featureId: feature.featureId })
  }
  for (const file of analysis.inventory.files) if (matches(term, file.path)) results.push({ id: `file:${file.path}`, title: file.path, detail: 'Project file', section: 'files', filePath: file.path })

  return results.sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
}
