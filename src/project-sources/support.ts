import type { ProjectFile } from './types'

export type LocalProjectSupport = 'supported' | 'unsupported' | 'too-large'

export interface LocalProjectAssessment {
  support: LocalProjectSupport
  evidence: string[]
}

const MAX_PROJECT_FILES = 1500
const MAX_PROJECT_BYTES = 12 * 1024 * 1024

export function assessLocalProject(files: ProjectFile[]): LocalProjectAssessment {
  const totalBytes = files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).byteLength, 0)
  if (files.length > MAX_PROJECT_FILES || totalBytes > MAX_PROJECT_BYTES) return { support: 'too-large', evidence: [`${files.length} files and ${totalBytes} bytes were prepared.`] }
  const packageFile = files.find((file) => /(^|\/)package\.json$/i.test(file.path))
  let packageData: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined
  try { packageData = packageFile ? JSON.parse(packageFile.content) as typeof packageData : undefined } catch { packageData = undefined }
  const dependencies = { ...(packageData?.dependencies ?? {}), ...(packageData?.devDependencies ?? {}) }
  const hasReact = Boolean(dependencies.react || dependencies['react-dom'])
  const hasVite = Boolean(dependencies.vite) || files.some((file) => /(^|\/)vite\.config\.[cm]?[jt]sx?$/i.test(file.path))
  const hasSource = files.some((file) => /(^|\/)(src|app)\/.+\.(jsx?|tsx?)$/i.test(file.path))
  const evidence: string[] = []
  if (hasReact) evidence.push('React dependency found.')
  if (hasVite) evidence.push('Vite dependency or configuration found.')
  if (hasSource) evidence.push('React source files found.')
  return { support: hasReact && hasVite && hasSource ? 'supported' : 'unsupported', evidence }
}
