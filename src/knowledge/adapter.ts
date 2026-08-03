import { createHash } from 'node:crypto'
import type { ProjectAnalysis } from '../analysis'
import type { FeatureLearningPack } from '../learning'
import type { ProjectItem, ProjectKnowledgeBase, ProjectPart } from './types'

const excerptLimit = 2_000

function itemType(path: string): ProjectItem['itemType'] {
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|java|c|cc|cpp|h|hpp|go|rs|rb|php|sh)$/i.test(path)) return 'source'
  if (/\.(css|scss|less)$/i.test(path)) return 'style'
  if (/\.(md|txt|rst)$/i.test(path)) return 'document'
  if (/\.(json|csv|yaml|yml|toml|ini|cfg|xml)$/i.test(path)) return 'config'
  if (/\.ipynb$/i.test(path)) return 'notebook'
  return 'other'
}

function sourceFingerprint(project: ProjectAnalysis['project'], files: ProjectAnalysis['inventory']['files']) {
  const hash = createHash('sha256')
  hash.update(project.name)
  for (const file of files) hash.update(`\0${file.path}\0${file.content}`)
  return hash.digest('hex')
}

function languageFor(path: string) {
  if (/\.(py)$/i.test(path)) return 'Python'
  if (/\.(ts|tsx)$/i.test(path)) return 'TypeScript'
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return 'JavaScript'
  if (/\.(java)$/i.test(path)) return 'Java'
  if (/\.(c|h)$/i.test(path)) return 'C'
  if (/\.(cc|cpp|cxx|hpp)$/i.test(path)) return 'C++'
  if (/\.(go)$/i.test(path)) return 'Go'
  if (/\.(rs)$/i.test(path)) return 'Rust'
  if (/\.ipynb$/i.test(path)) return 'Notebook'
  return undefined
}

function isManifest(path: string) { return /(^|\/)(package\.json|pyproject\.toml|requirements(?:\.txt)?|setup\.py|pom\.xml|build\.gradle|cargo\.toml|go\.mod|cmakelists\.txt)$/i.test(path) }
function isEntry(path: string) { return /(^|\/)(main|index|app|server|cli|manage)\.[^.]+$/i.test(path) || /(^|\/)(main|app)\.py$/i.test(path) }
function isTest(path: string) { return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[^.]+$/i.test(path) }
function isDocumentation(path: string) { return /(^|\/)(readme|contributing|architecture)(\.[^.]+)?$/i.test(path) }

function selectImportantFiles(analysis: ProjectAnalysis['inventory']['files']) {
  const ranked = analysis.map((file) => {
    let score = 0
    if (isManifest(file.path)) score += 8
    if (isEntry(file.path)) score += 7
    if (isDocumentation(file.path)) score += 6
    if (isTest(file.path)) score += 2
    if (file.path.split('/').length === 1) score += 1
    return { file, score }
  }).sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
  const selected = ranked.filter((item) => item.score > 0).slice(0, 40)
  if (selected.length < 12) selected.push(...ranked.filter((item) => !selected.some((current) => current.file.path === item.file.path)).slice(0, 12 - selected.length))
  return selected.map(({ file }) => file).sort((left, right) => left.path.localeCompare(right.path))
}

function dependencyNames(files: ProjectAnalysis['inventory']['files']) {
  const names: string[] = []
  for (const file of files) {
    if (file.path.toLowerCase().endsWith('package.json')) {
      try { const parsed = JSON.parse(file.content) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }; names.push(...Object.keys({ ...parsed.dependencies, ...parsed.devDependencies })) } catch { /* deterministic evidence remains valid without malformed metadata */ }
    }
    if (/requirements(?:\.txt)?$/i.test(file.path)) names.push(...file.content.split(/\r?\n/).map((line) => line.trim().match(/^([A-Za-z0-9_.-]+)/)?.[1] ?? '').filter(Boolean))
    if (/pyproject\.toml$/i.test(file.path)) {
      names.push(...[...file.content.matchAll(/^[\s-]*([A-Za-z0-9_.-]+)(?:\s*[=<>!~])/gm)].map((match) => match[1]))
      names.push(...[...file.content.matchAll(/dependencies\s*=\s*\[[^\]]*?["']([^"']+)/gim)].map((match) => match[1].split(/[<>=!~]/)[0]))
    }
  }
  return [...new Set(names)].sort().slice(0, 30)
}

function projectCommands(files: ProjectAnalysis['inventory']['files']) {
  const manifest = files.find((file) => /(^|\/)package\.json$/i.test(file.path))
  if (!manifest) return []
  try {
    const scripts = (JSON.parse(manifest.content) as { scripts?: Record<string, unknown> }).scripts ?? {}
    return Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string').sort(([left], [right]) => left.localeCompare(right)).slice(0, 12).map(([name, command]) => ({ command: `npm run ${name}`, description: `Runs \`${command}\`, defined in ${manifest.path}.` }))
  } catch { return [] }
}

function makePart(id: string, name: string, files: ProjectItem[], analysis: ProjectAnalysis): ProjectPart {
  const relationships = analysis.relationships.filter((relationship) => files.some((file) => file.path === relationship.fromPath)).slice(0, 20).map((relationship) => `${relationship.fromPath} imports ${relationship.specifier}${relationship.resolvedPath ? ` → ${relationship.resolvedPath}` : ''}.`)
  const example = files.find((file) => file.optionalPreview)
  return { id, name, plainPurpose: `${files.length} evidence-backed file${files.length === 1 ? '' : 's'} selected for this project area.`, relevantFiles: files, relationships, codeExamples: example?.optionalPreview ? [{ label: example.path, code: example.optionalPreview }] : undefined, analysisStatus: 'analysed' }
}

export function createProjectKnowledgeBase(analysis: ProjectAnalysis, packs: FeatureLearningPack[] = [], sourceType = 'Software project'): ProjectKnowledgeBase {
  const selected = selectImportantFiles(analysis.inventory.files)
  const importantFiles: ProjectItem[] = selected.map((file) => ({ id: file.path, path: file.path, itemType: itemType(file.path), purpose: isManifest(file.path) ? 'Dependency or project configuration evidence.' : isEntry(file.path) ? 'Likely project entry point.' : isDocumentation(file.path) ? 'Project documentation evidence.' : 'Selected evidence file.', analysisStatus: 'analysed', optionalPreview: file.content.slice(0, excerptLimit) }))
  const packsById = new Map(packs.map((pack) => [pack.featureId, pack]))
  const groups: Array<[string, string, (file: ProjectItem) => boolean]> = [['entry-points', 'Entry points', (file) => isEntry(file.path)], ['configuration', 'Configuration and dependencies', (file) => isManifest(file.path)], ['documentation', 'Documentation', (file) => isDocumentation(file.path)], ['tests', 'Tests', (file) => isTest(file.path)]]
  const projectParts: ProjectPart[] = []
  for (const [id, name, predicate] of groups) { const files = importantFiles.filter(predicate); if (files.length) projectParts.push(makePart(id, name, files, analysis)) }
  const grouped = new Set(projectParts.flatMap((part) => part.relevantFiles?.map((file) => file.path) ?? [])); const remaining = importantFiles.filter((file) => !grouped.has(file.path)); if (remaining.length) projectParts.push(makePart('source-structure', 'Source structure', remaining, analysis))
  for (const feature of analysis.features) {
    const pack = packsById.get(feature.featureId); const relevantFiles = feature.relevantFiles.map((file) => importantFiles.find((item) => item.path === file.path)).filter((item): item is ProjectItem => Boolean(item)); if (!relevantFiles.length) continue
    projectParts.push({ ...makePart(feature.featureId, feature.label, relevantFiles, analysis), plainPurpose: pack?.summary ?? `Evidence-backed files related to ${feature.label}.`, canonicalTopics: pack?.concepts.map((concept) => ({ name: concept.canonicalName, explanation: concept.plainExplanation, whyItExists: concept.whyItExists, evidenceFiles: concept.evidenceFiles })), essentialDecisions: pack?.complexityItems.filter((item) => item.classification === 'essential').map((item) => ({ title: item.title, note: item.explanation })), reviewItems: pack?.complexityItems.filter((item) => item.classification === 'review-before-copy').map((item) => ({ title: item.title, note: item.explanation })), learningTopics: pack?.learningSteps, technicalEvidence: feature.evidence.length ? [{ confidence: feature.confidence, facts: feature.evidence.map((item) => `${item.path}: ${item.fact}`) }] : undefined })
  }
  const languages = [...new Set(analysis.inventory.files.map((file) => languageFor(file.path)).filter(Boolean))].sort() as string[]
  const dependencies = dependencyNames(analysis.inventory.files)
  const commands = projectCommands(analysis.inventory.files)
  const relationships = analysis.relationships.filter((item) => item.resolution === 'resolved' && item.resolvedPath).map((item) => ({ fromPath: item.fromPath, toPath: item.resolvedPath!, type: 'imports' as const, status: 'analysed' as const })).sort((left, right) => left.fromPath.localeCompare(right.fromPath) || left.toPath.localeCompare(right.toPath))
  const technologies = [...new Set([analysis.project.framework, ...dependencies])].filter((value) => value && value !== 'Software project').slice(0, 40)
  const learningOrder = projectParts.map((part, index) => ({ order: index + 1, topic: part.name, reason: `Start with the evidence-backed ${part.name.toLowerCase()} area.`, partId: part.id }))
  const fingerprint = sourceFingerprint(analysis.project, analysis.inventory.files)
  return { id: analysis.project.id, name: analysis.project.name, sourceType, category: analysis.project.framework, summary: `${analysis.project.name} contains ${analysis.inventory.files.length} analysed files across ${languages.join(', ') || 'an undetermined language set'}.`, purpose: 'Understand the selected project as a working system before changing it.', metadata: [{ label: 'Project type', value: analysis.project.framework }, { label: 'Analysed files', value: String(analysis.inventory.files.length) }, { label: 'Static imports', value: String(analysis.importCount) }, { label: 'Source fingerprint', value: fingerprint.slice(0, 12) }], detectedLanguages: languages, detectedFrameworks: analysis.project.framework === 'Software project' ? [] : [analysis.project.framework], technologies, projectParts, importantFiles, commands, relationships, learningOrder, technicalEvidence: [`${analysis.importCount} static import relationships were inspected.`], limitations: ['Static import analysis currently supports JavaScript, JSX, TypeScript, and TSX. Dynamic imports, aliases, and package internals are not inspected.', 'Evidence is bounded to selected readable text files. Binary content and generated output are not inspected.'], analysisCoverage: { analysed: analysis.inventory.files.length, detected: projectParts.length, skipped: 0, unsupported: 0 }, sourceFingerprint: fingerprint }
}
