import { describe, expect, it } from 'vitest'
import { createPresentationSchema } from '../src/knowledge'
import { validatePresentationKnowledgeBase } from '../src/knowledge'
import type { ProjectKnowledgeBase } from '../src/knowledge'

const knowledge = { importantFiles: [{ path: 'src/main.tsx' }], projectParts: [] } as ProjectKnowledgeBase
describe('generated presentation schema contract', () => {
  it('gives the constant version a JSON Schema type for Codex repair', () => {
    const schema = createPresentationSchema() as { properties: { version: unknown } }
    expect(schema.properties.version).toEqual({ type: 'string', const: '1.0' })
  })

  it('requires the same version and project name accepted by the validator', () => {
    const schema = createPresentationSchema() as { required: string[]; additionalProperties: boolean }
    expect(schema.required).toEqual(['version', 'projectName']); expect(schema.additionalProperties).toBe(false)
    expect(validatePresentationKnowledgeBase({ version: '1.0', projectName: 'Sample' }, knowledge)).toEqual([])
    expect(validatePresentationKnowledgeBase({ version: '2.0', projectName: 'Sample' }, knowledge)).toContain('project: unsupported schema version')
  })
})
