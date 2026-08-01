import { describe, expect, it } from 'vitest'
import { assessLocalProject } from '../src/project-sources/support'

const supported = [
  { path: 'package.json', content: JSON.stringify({ dependencies: { react: '^19', 'react-dom': '^19' }, devDependencies: { vite: '^8' } }) },
  { path: 'src/App.tsx', content: 'export default function App() { return null }' },
]

describe('local project support', () => {
  it('recognises React/Vite evidence regardless of the folder name', () => {
    expect(assessLocalProject(supported).support).toBe('supported')
  })

  it('accepts a random text-based software folder', () => {
    expect(assessLocalProject([{ path: 'main.py', content: 'print(1)' }])).toMatchObject({ support: 'supported', projectType: 'Software project' })
  })

  it('does not rely on the project display name', () => {
    expect(assessLocalProject([{ path: 'Python/package.json', content: JSON.stringify({ dependencies: { react: '^19' } }) }, { path: 'Python/src/main.ts', content: '' }])).toMatchObject({ support: 'supported', projectType: 'JavaScript/TypeScript' })
  })
})
