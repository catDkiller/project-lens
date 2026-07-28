import { describe, expect, it } from 'vitest'
import { buildImportGraph, createProjectInventory, detectFeatures } from '../src/analysis'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import type { NormalizedProject } from '../src/project-sources/types'

function detect(project: NormalizedProject) {
  const inventory = createProjectInventory(project)
  return detectFeatures(inventory, buildImportGraph(inventory), preparedSampleFeatureDefinitions)
}

function project(files: NormalizedProject['files']): NormalizedProject {
  return { id: 'test', name: 'Test project', framework: 'react-vite', files }
}

describe('detectFeatures', () => {
  it('detects navigation, login, and dashboard in the prepared sample', () => {
    const features = detect(preparedViteSample)

    expect(features.map((feature) => feature.featureId)).toEqual(['navigation', 'login', 'dashboard'])
    expect(features.every((feature) => feature.relevantFiles.length > 0)).toBe(true)
  })

  it('keeps scores and reasons stable', () => {
    const navigation = detect(preparedViteSample).find((feature) => feature.featureId === 'navigation')
    const header = navigation?.relevantFiles.find((file) => file.path === 'src/components/AppHeader.tsx')

    expect(header).toEqual({
      path: 'src/components/AppHeader.tsx',
      score: 14,
      reasons: [
        'Filename contains a navigation hint.',
        'Contains navigation link JSX.',
        'Exports a navigation-matching component.',
        'Imports React Router.',
      ],
    })
    expect(navigation?.confidence).toBe('high')
  })

  it('excludes unrelated files without feature evidence', () => {
    const features = detect(preparedViteSample)
    expect(features.flatMap((feature) => feature.relevantFiles).map((file) => file.path)).not.toContain('src/utils/formatDate.ts')
  })

  it('includes one directly imported file from a strong dashboard entry', () => {
    const dashboard = detect(preparedViteSample).find((feature) => feature.featureId === 'dashboard')
    const metricCard = dashboard?.relevantFiles.find((file) => file.path === 'src/components/MetricCard.tsx')

    expect(metricCard?.reasons).toEqual(['Imported directly by strong dashboard file src/pages/DashboardPage.tsx.'])
  })

  it('orders ties by path and caps relevant files at six', () => {
    const files = [
      { path: 'src/Dashboard.tsx', content: [
        'import "./z"', 'import "./y"', 'import "./x"', 'import "./w"', 'import "./v"', 'import "./u"',
      ].join('\n') },
      ...['z', 'y', 'x', 'w', 'v', 'u'].map((name) => ({ path: `src/${name}.tsx`, content: '' })),
    ]
    const dashboard = detect(project(files)).find((feature) => feature.featureId === 'dashboard')

    expect(dashboard?.relevantFiles).toHaveLength(6)
    expect(dashboard?.relevantFiles.map((file) => file.path)).toEqual([
      'src/Dashboard.tsx', 'src/u.tsx', 'src/v.tsx', 'src/w.tsx', 'src/x.tsx', 'src/y.tsx',
    ])
  })

  it('returns low-confidence empty results when supported features are missing', () => {
    const features = detect(project([{ path: 'src/utils/formatDate.ts', content: 'export const formatDate = () => ""' }]))

    expect(features).toEqual([
      { featureId: 'navigation', label: 'Navigation', confidence: 'low', relevantFiles: [], evidence: [] },
      { featureId: 'login', label: 'Login', confidence: 'low', relevantFiles: [], evidence: [] },
      { featureId: 'dashboard', label: 'Dashboard', confidence: 'low', relevantFiles: [], evidence: [] },
    ])
  })

  it('is deterministic when input file order changes', () => {
    expect(detect(preparedViteSample)).toEqual(detect({ ...preparedViteSample, files: [...preparedViteSample.files].reverse() }))
  })

  it('accepts a replaceable File Upload definition without changing the engine', () => {
    const features = detectFeatures(
      createProjectInventory(project([{ path: 'src/FileUpload.tsx', content: '<input type="file" />' }])),
      [],
      [{ id: 'file-upload', label: 'File Upload', filenameTokens: ['file', 'upload'], contentRules: [{ pattern: /type="file"/, fact: 'Contains a file input.', weight: 4 }] }],
    )

    expect(features[0]).toMatchObject({ featureId: 'file-upload', confidence: 'high' })
  })

  it('uses medium confidence for a single strong filename hint', () => {
    const [feature] = detectFeatures(
      createProjectInventory(project([{ path: 'src/Reports.tsx', content: '' }])),
      [],
      [{ id: 'reports', label: 'Reports', filenameTokens: ['reports'] }],
    )

    expect(feature.confidence).toBe('medium')
  })
})
