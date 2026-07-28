import { describe, expect, it } from 'vitest'
import { buildImportGraph, createProjectInventory, extractStaticImportSpecifiers } from '../src/analysis'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import type { NormalizedProject } from '../src/project-sources/types'

function project(files: NormalizedProject['files']): NormalizedProject {
  return { id: 'test', name: 'Test project', framework: 'react-vite', files }
}

describe('createProjectInventory', () => {
  it('inventories the prepared sample project', () => {
    expect(createProjectInventory(preparedViteSample).files.map((file) => file.path)).toEqual([
      'src/App.tsx', 'src/main.tsx',
    ])
  })

  it('normalizes paths, classifies files, and sorts output deterministically', () => {
    const inventory = createProjectInventory(project([
      { path: 'src\\zebra.js', content: '' },
      { path: './src/App.tsx', content: '' },
      { path: 'src/styles.css', content: '' },
    ]))

    expect(inventory.files.map((file) => [file.path, file.type])).toEqual([
      ['src/App.tsx', 'typescript'],
      ['src/styles.css', 'stylesheet'],
      ['src/zebra.js', 'javascript'],
    ])
  })

  it('ignores generated directories, lock files, maps, and binaries', () => {
    const inventory = createProjectInventory(project([
      { path: 'src/App.tsx', content: '' },
      { path: 'node_modules/react/index.js', content: '' },
      { path: 'dist/app.js', content: '' },
      { path: 'build/app.js', content: '' },
      { path: 'coverage/report.html', content: '' },
      { path: '.git/config', content: '' },
      { path: 'package-lock.json', content: '{}' },
      { path: 'src/app.js.map', content: '' },
      { path: 'src/logo.png', content: 'binary' },
    ]))

    expect(inventory.files.map((file) => file.path)).toEqual(['src/App.tsx'])
  })
})

describe('static imports', () => {
  it('extracts supported import and re-export forms', () => {
    const content = [
      'import LoginForm from "./LoginForm"',
      'import { Button } from "./Button"',
      'import "./styles.css"',
      'export { Button } from "./Button"',
      'export * from "./public-api"',
    ].join('\n')

    expect(extractStaticImportSpecifiers(content)).toEqual([
      './LoginForm', './Button', './styles.css', './Button', './public-api',
    ])
  })

  it('resolves extensionless and index-file relative imports', () => {
    const inventory = createProjectInventory(project([
      { path: 'src/App.tsx', content: 'import LoginForm from "./LoginForm"\nimport "./components"' },
      { path: 'src/LoginForm.tsx', content: '' },
      { path: 'src/components/index.ts', content: '' },
    ]))

    expect(buildImportGraph(inventory)).toEqual([
      { fromPath: 'src/App.tsx', specifier: './LoginForm', kind: 'relative', resolution: 'resolved', resolvedPath: 'src/LoginForm.tsx' },
      { fromPath: 'src/App.tsx', specifier: './components', kind: 'relative', resolution: 'resolved', resolvedPath: 'src/components/index.ts' },
    ])
  })

  it('extracts imports from JavaScript, JSX, TypeScript, and TSX files', () => {
    const inventory = createProjectInventory(project([
      { path: 'src/a.js', content: 'import "./shared"' },
      { path: 'src/b.jsx', content: 'import "./shared"' },
      { path: 'src/c.ts', content: 'import "./shared"' },
      { path: 'src/d.tsx', content: 'import "./shared"' },
      { path: 'src/shared.ts', content: '' },
    ]))

    expect(buildImportGraph(inventory).filter((relationship) => relationship.specifier === './shared')).toHaveLength(4)
  })

  it('marks package and unknown relative imports without guessing', () => {
    const inventory = createProjectInventory(project([
      { path: 'src/App.tsx', content: 'import React from "react"\nimport "./missing"' },
    ]))

    expect(buildImportGraph(inventory)).toEqual([
      { fromPath: 'src/App.tsx', specifier: 'react', kind: 'package', resolution: 'external' },
      { fromPath: 'src/App.tsx', specifier: './missing', kind: 'relative', resolution: 'unresolved' },
    ])
  })

  it('resolves explicit extensions and parent-directory paths', () => {
    const inventory = createProjectInventory(project([
      { path: 'src/pages/Login.tsx', content: 'export { value } from "../shared/value.ts"' },
      { path: 'src/shared/value.ts', content: '' },
    ]))

    expect(buildImportGraph(inventory)).toEqual([
      { fromPath: 'src/pages/Login.tsx', specifier: '../shared/value.ts', kind: 'relative', resolution: 'resolved', resolvedPath: 'src/shared/value.ts' },
    ])
  })
})
