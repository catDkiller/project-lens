export type InventoryFileType = 'javascript' | 'typescript' | 'stylesheet' | 'markup' | 'json' | 'other'

export interface InventoryFile {
  path: string
  content: string
  type: InventoryFileType
}

export interface ProjectInventory {
  files: InventoryFile[]
}

export interface ImportRelationship {
  fromPath: string
  specifier: string
  kind: 'relative' | 'package'
  resolution: 'resolved' | 'unresolved' | 'external'
  resolvedPath?: string
}
