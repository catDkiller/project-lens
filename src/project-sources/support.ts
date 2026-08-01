import type { ProjectFile } from './types'

export type LocalProjectSupport = 'supported' | 'too-large'

export interface LocalProjectAssessment {
  support: LocalProjectSupport
  evidence: string[]
  projectType: string
}

const MAX_PROJECT_FILES = 1500
const MAX_PROJECT_BYTES = 12 * 1024 * 1024

export function assessLocalProject(files: ProjectFile[]): LocalProjectAssessment {
  const totalBytes = files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).byteLength, 0)
  if (files.length > MAX_PROJECT_FILES || totalBytes > MAX_PROJECT_BYTES) return { support: 'too-large', projectType: 'Software project', evidence: [`${files.length} files and ${totalBytes} bytes were prepared.`] }
  const names = new Set(files.map((file) => file.path.toLowerCase().split('/').at(-1)))
  const markers = [names.has('pyproject.toml') || names.has('requirements.txt') || names.has('setup.py') ? 'Python' : '', names.has('package.json') ? 'JavaScript/TypeScript' : '', names.has('pom.xml') || names.has('build.gradle') ? 'Java' : '', names.has('cmakelists.txt') || files.some((file) => /\.(c|cc|cpp|h|hpp)$/i.test(file.path)) ? 'C/C++' : '', files.some((file) => file.path.toLowerCase().endsWith('.ipynb')) ? 'Notebook/data science' : ''].filter(Boolean)
  const evidence = markers.map((marker) => `${marker} project markers found.`)
  return { support: 'supported', projectType: markers.length > 1 ? 'Mixed project' : markers[0] ?? 'Software project', evidence: evidence.length ? evidence : ['Text-based software files found.'] }
}
