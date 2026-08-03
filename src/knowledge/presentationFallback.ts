import type { ProjectKnowledgeBase } from './types'
import type { PresentationKnowledgeBase } from './presentationTypes'

export function createPresentationFallback(knowledge: ProjectKnowledgeBase): PresentationKnowledgeBase {
  const files = knowledge.importantFiles ?? []
  const parts = knowledge.projectParts ?? []
  const entry = files.find((file) => /(^|\/)(main|index)\.(tsx?|jsx?)$/i.test(file.path))
  const concepts = knowledge.detectedFrameworks?.map((framework) => ({ id: framework, title: framework, explanation: `A main technology this project relies on. Start here before reading its project-specific code.`, technicalName: framework, analysisStatus: 'analysed' as const })) ?? []
  const connected = entry ? (knowledge.relationships ?? []).filter((item) => item.fromPath === entry.path).slice(0, 3) : []
  const flow = entry ? [{ id: 'start', title: 'The application starts', explanation: `${entry.path} is a likely startup file selected from the analysed project.`, relatedEvidence: [{ path: entry.path }], analysisStatus: 'inferred' as const }, ...connected.map((item) => ({ id: `${item.fromPath}-${item.toPath}`, title: `${item.fromPath} imports ${item.toPath}`, explanation: 'This direct module relationship was confirmed by static import analysis. It shows one file becoming available to another.', relatedEvidence: [{ path: item.fromPath }, { path: item.toPath }], analysisStatus: 'analysed' as const }))] : []
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
      concepts.length ? { id: 'concepts', title: 'Concepts to know', shortExplanation: 'Learn these terms before following the project flow.', items: concepts } : undefined,
      flow.length ? { id: 'how-it-works', title: 'How the project works', shortExplanation: 'This is a bounded flow derived from entry-file and import evidence.', items: flow } : undefined,
      files.length ? { id: 'start-here', title: 'Start here', items: files.slice(0, 5).map((file, index) => ({ id: file.id, title: `Step ${index + 1}: ${file.path}`, explanation: index === 0 ? 'Read this first to understand how the project begins or is configured.' : 'Read this next after the earlier lesson gives you its context.', relatedEvidence: [{ path: file.path }], analysisStatus: file.analysisStatus })) } : undefined,
      knowledge.commands?.length ? { id: 'commands', title: 'Commands at a glance', items: knowledge.commands.map((command) => ({ id: command.command, title: command.command, explanation: command.description, analysisStatus: 'analysed' as const })) } : undefined,
      parts.length ? { id: 'project-structure', title: 'Project structure', items: parts.map((part) => ({ id: part.id, title: part.name, explanation: part.plainPurpose, relatedEvidence: part.relevantFiles?.map((file) => ({ path: file.path })) })) } : undefined,
    ].filter(Boolean) as NonNullable<PresentationKnowledgeBase['sections']>,
    projectParts: parts.map((part) => ({ id: part.id, title: part.name, shortExplanation: part.plainPurpose, technicalName: part.name, relatedFiles: part.relevantFiles?.map((file) => file.path), items: part.canonicalTopics?.map((topic) => ({ id: topic.name, title: topic.name, explanation: topic.explanation, whyItMatters: topic.whyItExists, technicalName: topic.name, relatedEvidence: topic.evidenceFiles.map((path) => ({ path })) })), learningPath: part.learningTopics?.map((topic) => ({ id: String(topic.order), title: topic.topic, explanation: topic.reason })), essentialComplexity: part.essentialDecisions?.map((item) => ({ id: item.title, title: item.title, explanation: item.note })), reviewBeforeCopying: part.reviewItems?.map((item) => ({ id: item.title, title: item.title, explanation: item.note })), evidenceReferences: part.technicalEvidence?.flatMap((evidence) => evidence.facts.map((fact) => ({ path: fact.split(':')[0] ?? '', fact }))) })),
    technologies: knowledge.technologies?.map((name) => ({ name })),
    files: files.map((file) => ({ path: file.path, explanation: file.purpose === 'Analysed project file.' ? 'The file was found, but its exact role could not be confirmed.' : file.purpose, itemType: file.itemType, analysisStatus: file.analysisStatus })),
    relationships: knowledge.relationships,
    symbols: knowledge.symbols,
    limitations: knowledge.limitations?.length ? { id: 'analysis-notes', title: 'Analysis notes', items: knowledge.limitations.map((item, index) => ({ id: String(index), title: 'What was not checked', explanation: item })) } : undefined,
    technicalReference: [...parts.map((part) => ({ id: `${part.id}-evidence`, title: `${part.name} technical details`, technicalName: part.name, relatedFiles: part.relevantFiles?.map((file) => file.path), items: part.technicalEvidence?.flatMap((evidence) => evidence.facts.map((fact, index) => ({ id: String(index), title: evidence.confidence, explanation: fact, technicalName: fact }))) })), ...(knowledge.relationships?.length ? [{ id: 'verified-file-communication', title: 'Verified file communication', shortExplanation: 'These edges are direct resolved imports, not a complete call graph.', importRelationships: knowledge.relationships.slice(0, 30).map((item) => `${item.fromPath} imports ${item.toPath}`), relatedFiles: [...new Set(knowledge.relationships.flatMap((item) => [item.fromPath, item.toPath]))] }] : [])],
  }
}
