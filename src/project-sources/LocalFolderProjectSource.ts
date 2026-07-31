import { localProject } from './localFolderImport'
import type { NormalizedProject, ProjectFile, ProjectSource } from './types'

export function localFolderProjectSource(name: string, files: ProjectFile[]): ProjectSource {
  const project: NormalizedProject = localProject(name, files)
  return { id: project.id, kind: 'local-folder', label: name, load: async () => project }
}
