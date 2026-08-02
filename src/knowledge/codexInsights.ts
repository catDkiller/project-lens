import type { ProjectKnowledgeBase } from './types'
import type { PresentationKnowledgeBase, PresentationItem } from './presentationTypes'
import { createPresentationFallback } from './presentationFallback'
import { PROJECT_EXPLANATION_SYSTEM_PROMPT } from './prompts/projectExplanationPrompt'

export interface CodexInsightResponse {
  summary: string
  architecture: string
  importantFiles?: Array<{ path: string; explanation: string }>
  learningSteps?: Array<{ title: string; explanation: string; relatedFiles?: string[] }>
  warnings?: string[]
}

export function createCodexEvidencePrompt(knowledge: ProjectKnowledgeBase) {
  return `${PROJECT_EXPLANATION_SYSTEM_PROMPT}\n\nThis evidence comes from the user-selected folder. Use only the supplied evidence. Do not inspect the filesystem, execute commands, browse the web, or invent files, dependencies, or features. Return one JSON object with required summary and architecture fields only where evidence supports them.\n\n${JSON.stringify({ project: knowledge.name, type: knowledge.category, languages: knowledge.detectedLanguages, technologies: knowledge.technologies, importantFiles: knowledge.importantFiles, projectParts: knowledge.projectParts?.map((part) => ({ id: part.id, name: part.name, files: part.relevantFiles?.map((file) => file.path), relationships: part.relationships })), limitations: knowledge.limitations })}`
}

export function createCodexInsightSchema() {
  const text = { type: 'string', minLength: 1, maxLength: 500 }
  return { type: 'object', additionalProperties: false, required: ['summary', 'architecture'], properties: { summary: text, architecture: text } }
}

export function parseCodexInsights(value: unknown, knowledge: ProjectKnowledgeBase): { insights?: CodexInsightResponse; issues: string[] } {
  if (!value || typeof value !== 'object') return { issues: ['insight: malformed response'] }
  const candidate = value as Partial<CodexInsightResponse>
  const issues: string[] = []
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim() || candidate.summary.length > 500) issues.push('insight: summary is required')
  if (typeof candidate.architecture !== 'string' || !candidate.architecture.trim() || candidate.architecture.length > 500) issues.push('insight: architecture is required')
  const known = new Set(knowledge.importantFiles?.map((file) => file.path) ?? [])
  const insights: CodexInsightResponse = {
    summary: candidate.summary as string,
    architecture: candidate.architecture as string,
    importantFiles: Array.isArray(candidate.importantFiles) ? candidate.importantFiles.filter((item) => known.has(item.path)) : undefined,
    learningSteps: Array.isArray(candidate.learningSteps) ? candidate.learningSteps.map((step) => ({ ...step, relatedFiles: (step.relatedFiles ?? []).filter((file) => known.has(file)) })) : undefined,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 12) : undefined,
  }
  return issues.length ? { issues } : { insights, issues }
}

function itemId(value: string, index: number) { return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'}-${index}` }

export function buildPresentationKnowledgeBase(knowledge: ProjectKnowledgeBase, insights?: CodexInsightResponse): PresentationKnowledgeBase {
  const base = createPresentationFallback(knowledge)
  const presentation: PresentationKnowledgeBase = { ...base, shortSummary: insights?.summary ?? base.shortSummary, overview: { ...base.overview, whatItIs: insights?.architecture ?? base.overview?.whatItIs, usefulContext: insights?.warnings?.join(' ') ?? base.overview?.usefulContext } }
  if (insights?.importantFiles?.length) {
    const byPath = new Map(insights.importantFiles.map((file) => [file.path, file.explanation]))
    presentation.files = (presentation.files ?? []).map((file) => byPath.has(file.path) ? { ...file, explanation: byPath.get(file.path) } : file)
  }
  if (insights?.learningSteps?.length) {
    const known = new Set(knowledge.importantFiles?.map((file) => file.path) ?? [])
    const items: PresentationItem[] = insights.learningSteps.map((step, index) => ({ id: itemId(step.title, index), title: step.title, explanation: step.explanation, relatedEvidence: (step.relatedFiles ?? []).filter((file) => known.has(file)).map((path) => ({ path })), analysisStatus: 'inferred' }))
    presentation.learningPath = items
  }
  return presentation
}
