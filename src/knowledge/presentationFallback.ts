import type { ProjectKnowledgeBase } from './types'
import type { PresentationKnowledgeBase } from './presentationTypes'

export function createPresentationFallback(knowledge: ProjectKnowledgeBase): PresentationKnowledgeBase {
  const files = knowledge.importantFiles ?? []
  const parts = knowledge.projectParts ?? []
  return {
    version: '1.0',
    sourceFingerprint: knowledge.sourceFingerprint,
    projectName: knowledge.name,
    projectTypeLabel: knowledge.category,
    shortSummary: knowledge.summary,
    overview: {
      whatItIs: knowledge.purpose,
      mainParts: parts.slice(0, 6).map((part) => ({ id: part.id, title: part.name, explanation: part.plainPurpose, technicalName: part.name, analysisStatus: part.analysisStatus })),
      whereToStart: files.slice(0, 5).map((file) => ({ id: file.id, title: file.path, explanation: file.purpose === 'Analysed project file.' ? 'The file was found, but its exact role could not be confirmed.' : file.purpose, relatedEvidence: [{ path: file.path }], analysisStatus: file.analysisStatus })),
    },
    sections: [
      files.length ? { id: 'start-here', title: 'Start here', items: files.slice(0, 5).map((file) => ({ id: file.id, title: file.path, explanation: file.purpose, relatedEvidence: [{ path: file.path }] })) } : undefined,
      parts.length ? { id: 'project-structure', title: 'Project structure', items: parts.map((part) => ({ id: part.id, title: part.name, explanation: part.plainPurpose, relatedEvidence: part.relevantFiles?.map((file) => ({ path: file.path })) })) } : undefined,
    ].filter(Boolean) as NonNullable<PresentationKnowledgeBase['sections']>,
    projectParts: parts.map((part) => ({ id: part.id, title: part.name, shortExplanation: part.plainPurpose, technicalName: part.name, relatedFiles: part.relevantFiles?.map((file) => file.path), items: part.canonicalTopics?.map((topic) => ({ id: topic.name, title: topic.name, explanation: topic.explanation, whyItMatters: topic.whyItExists, technicalName: topic.name, relatedEvidence: topic.evidenceFiles.map((path) => ({ path })) })), learningPath: part.learningTopics?.map((topic) => ({ id: String(topic.order), title: topic.topic, explanation: topic.reason })), essentialComplexity: part.essentialDecisions?.map((item) => ({ id: item.title, title: item.title, explanation: item.note })), reviewBeforeCopying: part.reviewItems?.map((item) => ({ id: item.title, title: item.title, explanation: item.note })), evidenceReferences: part.technicalEvidence?.flatMap((evidence) => evidence.facts.map((fact) => ({ path: fact.split(':')[0] ?? '', fact }))) })),
    files: files.map((file) => ({ path: file.path, explanation: file.purpose === 'Analysed project file.' ? 'The file was found, but its exact role could not be confirmed.' : file.purpose, itemType: file.itemType, analysisStatus: file.analysisStatus })),
    limitations: knowledge.limitations?.length ? { id: 'analysis-notes', title: 'Analysis notes', items: knowledge.limitations.map((item, index) => ({ id: String(index), title: 'What was not checked', explanation: item })) } : undefined,
    technicalReference: parts.map((part) => ({ id: `${part.id}-evidence`, title: `${part.name} technical details`, technicalName: part.name, relatedFiles: part.relevantFiles?.map((file) => file.path), items: part.technicalEvidence?.flatMap((evidence) => evidence.facts.map((fact, index) => ({ id: String(index), title: evidence.confidence, explanation: fact, technicalName: fact }))) })),
  }
}
