import type { ProjectKnowledgeBase } from './types'
import type { EvidenceReference, PresentationKnowledgeBase, PresentationSection } from './presentationTypes'

const MAX_TITLE = 100
const MAX_TEXT = 500
const statuses = new Set(['analysed', 'inferred', 'detected', 'partial', 'unsupported', 'binary', 'skipped', 'generated', 'uncertain'])

function invalidText(value: string | undefined, allowEmpty = true) {
  return value !== undefined && (!allowEmpty && !value.trim() || value.length > MAX_TEXT || /<[^>]+>/.test(value))
}

function checkReferences(references: EvidenceReference[] | undefined, knownPaths: Set<string>, label: string, issues: string[]) {
  references?.forEach((reference) => {
    if (!knownPaths.has(reference.path)) issues.push(`${label}: unknown evidence ${reference.path}`)
    if (invalidText(reference.fact)) issues.push(`${label}: invalid evidence text`)
  })
}

function checkSection(section: PresentationSection, knownPaths: Set<string>, issues: string[]) {
  if (!section.id || !section.title.trim() || section.title.length > MAX_TITLE) issues.push(`section: invalid heading ${section.id || '(missing)'}`)
  if (invalidText(section.shortExplanation) || invalidText(section.deeperExplanation)) issues.push(`${section.id}: invalid text`)
  if (new Set(section.items?.map((item) => item.id)).size !== (section.items?.length ?? 0)) issues.push(`${section.id}: duplicate item identifiers`)
  section.items?.forEach((item) => {
    if (!item.id || !item.title.trim() || item.title.length > MAX_TITLE) issues.push(`${section.id}: invalid item heading`)
    if (invalidText(item.explanation) || invalidText(item.whyItMatters) || invalidText(item.technicalName)) issues.push(`${section.id}: invalid item text`)
    if (item.analysisStatus && !statuses.has(item.analysisStatus)) issues.push(`${section.id}: invalid analysis status`)
    checkReferences(item.relatedEvidence, knownPaths, section.id, issues)
  })
  section.relatedFiles?.forEach((path) => { if (!knownPaths.has(path)) issues.push(`${section.id}: unknown file ${path}`) })
  section.importRelationships?.forEach((relationship) => { if (invalidText(relationship, false)) issues.push(`${section.id}: invalid import relationship`) })
  section.codeExamples?.forEach((example) => {
    if (!knownPaths.has(example.label) || !example.code.trim() || example.code.length > 4000 || example.code.includes('```')) issues.push(`${section.id}: invalid code example`)
  })
  checkReferences(section.evidenceReferences, knownPaths, section.id, issues)
}

function validatePresentation(presentation: PresentationKnowledgeBase, knowledge: ProjectKnowledgeBase): string[] {
  const issues: string[] = []
  if (presentation.version !== '1.0') issues.push('project: unsupported schema version')
  if (presentation.sourceFingerprint !== undefined && presentation.sourceFingerprint !== knowledge.sourceFingerprint) issues.push('project: source fingerprint mismatch')
  const knownPaths = new Set(knowledge.importantFiles?.map((file) => file.path) ?? [])
  const partIds = new Set(knowledge.projectParts?.map((part) => part.id) ?? [])
  if (!presentation.projectName.trim()) issues.push('project: missing name')
  if (invalidText(presentation.shortSummary)) issues.push('project: invalid summary')
  const sectionIds = presentation.sections?.map((section) => section.id) ?? []
  if (new Set(sectionIds).size !== sectionIds.length) issues.push('project: duplicate section identifiers')
  presentation.sections?.forEach((section) => checkSection(section, knownPaths, issues))
  presentation.projectParts?.forEach((part) => {
    if (!partIds.has(part.id)) issues.push(`project part: unknown identifier ${part.id}`)
    checkSection(part, knownPaths, issues)
    ;[part.learningPath, part.essentialComplexity, part.reviewBeforeCopying].forEach((items) => items?.forEach((item) => {
      if (!item.id || !item.title.trim()) issues.push(`${part.id}: invalid item heading`)
      if (invalidText(item.explanation) || invalidText(item.whyItMatters)) issues.push(`${part.id}: invalid item text`)
      checkReferences(item.relatedEvidence, knownPaths, part.id, issues)
    }))
  })
  presentation.files?.forEach((file) => {
    if (!knownPaths.has(file.path)) issues.push(`files: unknown file ${file.path}`)
    if (invalidText(file.explanation)) issues.push(`files: invalid text for ${file.path}`)
    checkReferences(file.evidenceReferences, knownPaths, 'files', issues)
  })
  presentation.technologies?.forEach((technology) => {
    if (!technology.name.trim() || invalidText(technology.explanation)) issues.push('technologies: invalid technology')
    checkReferences(technology.evidenceReferences, knownPaths, 'technologies', issues)
  })
  if (presentation.limitations) checkSection(presentation.limitations, knownPaths, issues)
  presentation.technicalReference?.forEach((section) => checkSection(section, knownPaths, issues))
  return issues
}

export function validatePresentationKnowledgeBase(presentation: unknown, knowledge: ProjectKnowledgeBase): string[] {
  if (!presentation || typeof presentation !== 'object') return ['presentation: malformed output']
  try {
    return validatePresentation(presentation as PresentationKnowledgeBase, knowledge)
  } catch {
    return ['presentation: malformed output']
  }
}
