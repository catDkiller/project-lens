import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analysisEnvironment, analysisPermissionConfig, applyProviderAvailability, extractOpenCodeText, freeModelIds, isSafeAnalysisConfig, mapOpenCodeModels, mapOpenCodeProviders, OpenCodeTimeoutError, redact, resolveOpenCodeExecutable } from '../src/local-api/opencode'

describe('OpenCode local adapter', () => {
  it('does not hardcode models and maps OpenCode output', () => {
    expect(mapOpenCodeModels('provider-a/fast\nprovider-b/careful\nprovider-a/fast\n')).toEqual([
      { providerId: 'provider-a', modelId: 'fast', fullId: 'provider-a/fast', displayName: 'fast', availability: 'available', free: false, local: false },
      { providerId: 'provider-b', modelId: 'careful', fullId: 'provider-b/careful', displayName: 'careful', availability: 'available', free: false, local: false },
    ])
  })

  it('parses connected providers without credential values', async () => {
    const { mapOpenCodeProviders } = await import('../src/local-api/opencode')
    const providers = mapOpenCodeProviders('• Google api\n• OpenRouter env\n', ['ollama'])
    expect(providers).toEqual([{ id: 'google', displayName: 'Google', connected: true, connectionMethod: 'api' }, { id: 'ollama', displayName: 'ollama', connected: false }, { id: 'openrouter', displayName: 'OpenRouter', connected: true, connectionMethod: 'env' }])
    expect(JSON.stringify(providers)).not.toContain('key')
  })

  it('uses an isolated deny-by-default permission configuration', () => {
    expect(isSafeAnalysisConfig()).toBe(true)
    expect(analysisPermissionConfig.permission).toMatchObject({ '*': 'deny', read: 'allow', list: 'allow', glob: 'allow', grep: 'allow', edit: 'deny', bash: 'deny', webfetch: 'deny', task: 'deny', external_directory: 'deny' })
    expect(JSON.parse(analysisEnvironment({}).OPENCODE_CONFIG_CONTENT!)).toEqual(analysisPermissionConfig)
  })

  it('lists only IDs explicitly marked free', () => {
    expect(freeModelIds(mapOpenCodeModels('provider/free:free\nprovider/unknown\n'))).toEqual(['provider/free:free'])
  })

  it('separates catalogue entries from provider-confirmed runnable models', () => {
    const models = applyProviderAvailability(mapOpenCodeModels('google/gemini\nopencode/deepseek'), [
      { id: 'google', displayName: 'Google', connected: true },
      { id: 'opencode', displayName: 'opencode', connected: false },
    ])
    expect(models[0]).toMatchObject({ availability: 'ready', runnable: true })
    expect(models[1]).toMatchObject({ availability: 'requires-provider', runnable: false })
  })

  it('parses ANSI OpenCode auth output without exposing credentials', () => {
    expect(mapOpenCodeProviders('\u001b[34m•\u001b[39m Google \u001b[90mapi\u001b[39m', [])).toMatchObject([{ id: 'google', connected: true }])
  })

  it('keeps the timeout phase available for recovery messaging', () => {
    expect(new OpenCodeTimeoutError('provider-first-response')).toMatchObject({ timeoutType: 'provider-first-response' })
  })

  it('leaves an unavailable PATH unresolved', () => {
    expect(resolveOpenCodeExecutable({ PATH: path.join(process.cwd(), 'not-installed') })).toBeNull()
  })

  it('uses the final JSON text event and redacts credential-shaped stderr', () => {
    expect(extractOpenCodeText('{"text":"first"}\n{"part":{"text":"{\\"version\\":\\"1.0\\"}"}}')).toBe('{"version":"1.0"}')
    expect(redact('token=secret-value')).toBe('token=[redacted]')
  })
})
