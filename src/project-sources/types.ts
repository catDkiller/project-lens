export type ProjectSourceKind = 'bundled-sample' | 'local-folder' | 'github'

export interface ProjectFile { path: string; content: string }

export interface NormalizedProject {
  id: string
  name: string
  framework: 'react-vite'
  files: ProjectFile[]
}

export interface ProjectSource {
  id: string
  kind: ProjectSourceKind
  label: string
  load: () => Promise<NormalizedProject>
}

export interface ComingSoonProjectSource {
  id: string
  kind: Exclude<ProjectSourceKind, 'bundled-sample'>
  label: string
  status: 'coming-soon'
}
