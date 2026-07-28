import { addEvidence, confidenceFromScore, rankRelevantFiles, scoreFile } from './scoring'
import type { ScoredFile } from './scoring'
import type {
  FeatureDefinition,
  FeatureDetectionResult,
  ImportRelationship,
  ProjectInventory,
} from './types'

export function detectFeatures(
  inventory: ProjectInventory,
  relationships: ImportRelationship[],
  definitions: FeatureDefinition[],
): FeatureDetectionResult[] {
  return definitions.map((definition) => detectFeature(definition, inventory, relationships))
}

function detectFeature(
  definition: FeatureDefinition,
  inventory: ProjectInventory,
  relationships: ImportRelationship[],
): FeatureDetectionResult {
  const scoredFiles = new Map<string, ScoredFile>()

  for (const file of inventory.files) {
    if (filenameMatches(file.path, definition.filenameTokens)) {
      addEvidence(scoredFiles, file.path, 6, `Filename contains a ${definition.label.toLowerCase()} hint.`)
    }

    addContentEvidence(scoredFiles, file.path, file.content, definition.routeRules)
    addContentEvidence(scoredFiles, file.path, file.content, definition.contentRules)
  }

  for (const relationship of relationships) {
    for (const rule of definition.importRules ?? []) {
      if (rule.pattern.test(relationship.specifier)) {
        addEvidence(scoredFiles, relationship.fromPath, rule.weight, rule.fact)
      }
    }
  }

  addDirectImportExpansion(definition, relationships, scoredFiles)
  const relevantFiles = rankRelevantFiles(scoredFiles)
  const evidence = relevantFiles.flatMap((file) => scoredFiles.get(file.path)?.evidence ?? [])

  return {
    featureId: definition.id,
    label: definition.label,
    confidence: confidenceFromScore(relevantFiles[0]?.score ?? 0),
    relevantFiles,
    evidence,
  }
}

function addContentEvidence(
  scoredFiles: Map<string, ScoredFile>,
  path: string,
  content: string,
  rules: FeatureDefinition['contentRules'],
): void {
  for (const rule of rules ?? []) {
    if (rule.pattern.test(content)) addEvidence(scoredFiles, path, rule.weight, rule.fact)
  }
}

function addDirectImportExpansion(
  definition: FeatureDefinition,
  relationships: ImportRelationship[],
  scoredFiles: Map<string, ScoredFile>,
): void {
  const strongPaths = new Set([...scoredFiles.values()]
    .filter((file) => scoreFile(file) >= 5)
    .map((file) => file.path))

  for (const relationship of relationships) {
    if (relationship.resolution !== 'resolved' || !relationship.resolvedPath) continue

    if (strongPaths.has(relationship.fromPath) && !isApplicationShell(relationship.fromPath)) {
      addEvidence(scoredFiles, relationship.resolvedPath, 2, `Imported directly by strong ${definition.label.toLowerCase()} file ${relationship.fromPath}.`)
    }

    if (strongPaths.has(relationship.resolvedPath) && isApplicationShell(relationship.fromPath)) {
      addEvidence(scoredFiles, relationship.fromPath, 2, `Application shell imports strong ${definition.label.toLowerCase()} file ${relationship.resolvedPath}.`)
    }
  }
}

function filenameMatches(path: string, featureTokens: string[]): boolean {
  const filename = path.split('/').at(-1) ?? path
  const tokens = filename.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/)
  return tokens.some((token) => featureTokens.includes(token))
}

function isApplicationShell(path: string): boolean {
  return /(^|\/)(App|Layout|Shell)\.(js|jsx|ts|tsx)$/i.test(path)
}
