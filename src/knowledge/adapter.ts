import type { ProjectAnalysis } from '../analysis'
import type { FeatureLearningPack } from '../learning'
import type { ProjectItem, ProjectKnowledgeBase, ProjectPart } from './types'

function itemType(path: string): ProjectItem['itemType'] {
  if (/\.(ts|tsx|js|jsx)$/i.test(path)) return 'source'
  if (/\.css$/i.test(path)) return 'style'
  if (/\.(md|txt)$/i.test(path)) return 'document'
  if (/\.(json|csv)$/i.test(path)) return 'data'
  return 'other'
}

export function createProjectKnowledgeBase(analysis: ProjectAnalysis, packs: FeatureLearningPack[], sourceType = 'Sample'): ProjectKnowledgeBase {
  const packsById = new Map(packs.map((pack) => [pack.featureId, pack]))
  const importantFiles: ProjectItem[] = analysis.inventory.files.map((file) => ({
    id: file.path,
    path: file.path,
    itemType: itemType(file.path),
    purpose: 'Analysed project file.',
    analysisStatus: 'analysed',
    optionalPreview: file.content,
  }))
  const projectParts: ProjectPart[] = analysis.features.map((feature) => {
    const pack = packsById.get(feature.featureId)
    const relevantFiles = feature.relevantFiles.map((file) => importantFiles.find((item) => item.path === file.path)).filter((item): item is ProjectItem => Boolean(item))
    const relationshipFacts = analysis.relationships.filter((item) => feature.relevantFiles.some((file) => file.path === item.fromPath)).map((item) => `${item.fromPath} imports ${item.specifier}${item.resolvedPath ? ` → ${item.resolvedPath}` : ''}.`)
    const example = relevantFiles.find((item) => item.optionalPreview)
    return {
      id: feature.featureId,
      name: feature.label,
      plainPurpose: pack?.summary,
      summary: pack?.summary,
      canonicalTopics: pack?.concepts.map((concept) => ({ name: concept.canonicalName, explanation: concept.plainExplanation, whyItExists: concept.whyItExists, evidenceFiles: concept.evidenceFiles })),
      relevantFiles,
      relationships: relationshipFacts,
      codeExamples: example?.optionalPreview ? [{ label: example.path, code: example.optionalPreview }] : undefined,
      essentialDecisions: pack?.complexityItems.filter((item) => item.classification === 'essential').map((item) => ({ title: item.title, note: item.explanation })),
      reviewItems: pack?.complexityItems.filter((item) => item.classification === 'review-before-copy').map((item) => ({ title: item.title, note: item.explanation })),
      learningTopics: pack?.learningSteps,
      technicalEvidence: feature.evidence.length ? [{ confidence: feature.confidence, facts: feature.evidence.map((item) => `${item.path}: ${item.fact}`) }] : undefined,
      analysisStatus: feature.relevantFiles.length ? 'analysed' : 'uncertain',
      limitations: feature.relevantFiles.length ? undefined : ['No evidence-backed files were found for this detected project part.'],
    }
  })
  const technologies = [...new Set(projectParts.flatMap((part) => part.canonicalTopics?.map((topic) => topic.name) ?? []))]
  const learningOrder = projectParts.flatMap((part) => (part.learningTopics ?? []).map((topic) => ({ ...topic, partId: part.id }))).sort((left, right) => left.order - right.order || (left.partId ?? '').localeCompare(right.partId ?? ''))
  return {
    id: analysis.project.id,
    name: analysis.project.name,
    sourceType,
    category: 'web application',
    summary: `This project has ${analysis.inventory.files.length} analysed files and ${projectParts.length} detected project parts.`,
    purpose: 'Understand the project structure and implementation choices before reusing them.',
    metadata: [{ label: 'Framework', value: analysis.project.framework }, { label: 'Analysed files', value: String(analysis.inventory.files.length) }, { label: 'Static imports', value: String(analysis.importCount) }],
    detectedLanguages: [...new Set(analysis.inventory.files.filter((file) => file.type === 'typescript').map(() => 'TypeScript'))],
    detectedFrameworks: [analysis.project.framework],
    technologies,
    projectParts,
    importantFiles,
    decisions: projectParts.flatMap((part) => [...(part.essentialDecisions ?? []).map((item) => ({ ...item, status: 'essential' as const })), ...(part.reviewItems ?? []).map((item) => ({ ...item, status: 'review' as const }))]),
    learningOrder,
    limitations: ['Static import analysis currently supports JavaScript, JSX, TypeScript, and TSX. Dynamic imports, aliases, and package internals are not inspected.'],
    analysisCoverage: { analysed: analysis.inventory.files.length, detected: 0, skipped: 0, unsupported: 0 },
  }
}
