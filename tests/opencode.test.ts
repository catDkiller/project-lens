import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractOpenCodeText, mapOpenCodeModels, redact, resolveOpenCodeExecutable } from '../src/local-api/opencode'

describe('OpenCode local adapter', () => {
  it('does not hardcode models and maps OpenCode output', () => {
    expect(mapOpenCodeModels('provider-a/fast\nprovider-b/careful\nprovider-a/fast\n')).toEqual([
      { providerId: 'provider-a', modelId: 'fast', fullId: 'provider-a/fast', displayName: 'fast', availability: 'available' },
      { providerId: 'provider-b', modelId: 'careful', fullId: 'provider-b/careful', displayName: 'careful', availability: 'available' },
    ])
  })

  it('leaves an unavailable PATH unresolved', () => {
    expect(resolveOpenCodeExecutable({ PATH: path.join(process.cwd(), 'not-installed') })).toBeNull()
  })

  it('uses the final JSON text event and redacts credential-shaped stderr', () => {
    expect(extractOpenCodeText('{"text":"first"}\n{"part":{"text":"{\\"version\\":\\"1.0\\"}"}}')).toBe('{"version":"1.0"}')
    expect(redact('token=secret-value')).toBe('token=[redacted]')
  })
})
