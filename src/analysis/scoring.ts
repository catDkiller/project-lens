import type { FeatureDetectionResult, FeatureEvidence, RelevantFeatureFile } from './types'

export interface ScoredFile {
  path: string
  evidence: FeatureEvidence[]
}

export function addEvidence(scoredFiles: Map<string, ScoredFile>, path: string, weight: number, fact: string): void {
  const file = scoredFiles.get(path) ?? { path, evidence: [] }
  file.evidence.push({ path, fact, weight })
  scoredFiles.set(path, file)
}

export function rankRelevantFiles(scoredFiles: Map<string, ScoredFile>): RelevantFeatureFile[] {
  return [...scoredFiles.values()]
    .map((file) => ({ path: file.path, score: scoreFile(file), reasons: file.evidence.map((evidence) => evidence.fact) }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 6)
}

export function confidenceFromScore(score: number): FeatureDetectionResult['confidence'] {
  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

export function scoreFile(file: ScoredFile): number {
  return file.evidence.reduce((score, evidence) => score + evidence.weight, 0)
}
