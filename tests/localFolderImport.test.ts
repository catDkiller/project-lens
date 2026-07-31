import { describe, expect, it } from 'vitest'
import { localFolderProjectSource } from '../src/project-sources/LocalFolderProjectSource'
import { acceptsLocalPath, prepareLocalFiles, safeRelativePath } from '../src/project-sources/localFolderImport'

describe('local project import', () => {
  it('keeps safe nested text files in deterministic order', async () => {
    const prepared = prepareLocalFiles([
      { path: 'demo/src/App.tsx', content: 'export default null', size: 19 },
      { path: 'demo/src/components/Thing.tsx', content: 'export const Thing = 1', size: 22 },
    ])
    expect(prepared.files.map((file) => file.path)).toEqual(['demo/src/App.tsx', 'demo/src/components/Thing.tsx'])
    const source = localFolderProjectSource('Demo', prepared.files)
    expect(source.kind).toBe('local-folder')
    expect((await source.load()).files).toEqual(prepared.files)
  })

  it('rejects traversal, absolute, duplicate, generated, sensitive, binary and oversized files', () => {
    expect(safeRelativePath('../secret.ts')).toBeNull()
    expect(safeRelativePath('C:\\project\\App.tsx')).toBeNull()
    expect(acceptsLocalPath('node_modules/react/index.js', 1)).toBe(false)
    expect(acceptsLocalPath('src/.env.local', 1)).toBe(false)
    expect(acceptsLocalPath('src/certificate.pem', 1)).toBe(false)
    expect(acceptsLocalPath('src/image.png', 1)).toBe(false)
    expect(acceptsLocalPath('src/large.ts', 512_001)).toBe(false)
    const prepared = prepareLocalFiles([
      { path: 'src/App.tsx', content: 'one', size: 3 },
      { path: 'src/App.tsx', content: 'two', size: 3 },
      { path: 'src/bad.ts', content: 'a\0b', size: 3 },
      { path: '../escape.ts', content: 'no', size: 2 },
    ])
    expect(prepared).toMatchObject({ files: [{ path: 'src/App.tsx', content: 'one' }], skipped: 3 })
  })

  it('records safe skipped-file categories without retaining secret contents', () => {
    const prepared = prepareLocalFiles([
      { path: 'node_modules/react/index.js', content: 'ignored', size: 7 },
      { path: 'src/.env.local', content: 'SECRET=value', size: 12 },
      { path: 'image.png', content: 'binary', size: 6 },
    ])
    expect(prepared.skippedByReason).toMatchObject({ 'dependency-generated': 1, sensitive: 1, 'binary-unsupported': 1 })
    expect(JSON.stringify(prepared)).not.toContain('SECRET=value')
  })
})
