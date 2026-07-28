import { describe, expect, it } from 'vitest'
import { bundledSampleProjectSource } from '../src/project-sources/BundledSampleProjectSource'

describe('BundledSampleProjectSource', () => {
  it('loads normalized React/Vite project data', async () => {
    const project = await bundledSampleProjectSource.load()
    expect(project.framework).toBe('react-vite')
    expect(project.files.map((file) => file.path)).toContain('src/App.tsx')
  })
})
