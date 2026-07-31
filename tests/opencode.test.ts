import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analysisEnvironment, analysisPermissionConfig, applyProviderAvailability, buildAnalysisArgs, canStartOpenCodeAnalysis, classifyOpenCodeFailure, extractOpenCodeText, freeModelIds, isSafeAnalysisConfig, mapOpenCodeModels, mapOpenCodeProviders, OPEN_CODE_TIMEOUTS, openCodeDiagnosticArgs, openCodeFailureMessage, OpenCodeFailureError, OpenCodeTimeoutError, parseOpenCodeEvents, redact, resolveOpenCodeExecutable } from '../src/local-api/opencode'

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

  it('does not treat a free catalogue suffix as provider readiness', () => {
    const [model] = applyProviderAvailability(mapOpenCodeModels('opencode/deepseek-v4-flash-free'), [{ id: 'opencode', displayName: 'OpenCode', connected: false }])
    expect(model).toMatchObject({ fullId: 'opencode/deepseek-v4-flash-free', availability: 'requires-provider', runnable: false })
    expect(canStartOpenCodeAnalysis(model)).toBe(false)
  })

  it('marks a connected OpenCode provider as ready', () => {
    const [model] = applyProviderAvailability(mapOpenCodeModels('opencode/deepseek-v4-flash-free'), [{ id: 'opencode', displayName: 'OpenCode', connected: true }])
    expect(model).toMatchObject({ availability: 'ready', runnable: true })
    expect(canStartOpenCodeAnalysis(model)).toBe(true)
  })

  it('maps known failures to specific, safe recovery categories', () => {
    expect(classifyOpenCodeFailure(new OpenCodeFailureError('provider-authentication-required', 'Connect OpenCode to use this model.'))).toBe('provider-authentication-required')
    expect(classifyOpenCodeFailure(new Error('429 rate limit reached'))).toBe('free-quota-or-rate-limit')
    expect(classifyOpenCodeFailure(new Error('Unknown model'))).toBe('model-unavailable')
    expect(classifyOpenCodeFailure(new Error('Unknown option --agent'))).toBe('invalid-opencode-arguments')
    expect(classifyOpenCodeFailure(new Error('database is locked'))).toBe('permission-or-configuration-failure')
    expect(classifyOpenCodeFailure(new Error('spawn ENOENT'))).toBe('process-startup-failure')
    expect(classifyOpenCodeFailure(new Error('OpenCode did not return structured JSON.'))).toBe('parser-failure')
    expect(classifyOpenCodeFailure(new Error('ECONNREFUSED provider'))).toBe('network-or-provider-failure')
    expect(openCodeFailureMessage('provider-authentication-required')).toContain('authenticated OpenCode provider')
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

  it('uses a short positional prompt and an attached request file', () => {
    const args = buildAnalysisArgs('google/gemini-2.5-pro', 'C:/temp/workspace', 'C:/temp/workspace/.project-lens-request.json')
    expect(args).toContain('--file')
    expect(args).toContain('C:/temp/workspace/.project-lens-request.json')
    expect(args.at(-1)).toBe('Read the attached Project Lens request and return only the required JSON.')
    expect(args.join(' ').length).toBeLessThan(1_000)
  })

  it('uses phase-aware timeout defaults and parses fragmented-safe NDJSON lines', () => {
    expect(OPEN_CODE_TIMEOUTS).toEqual({ processStartMs: 30_000, firstResponseMs: 240_000, inactivityMs: 120_000, totalRunMs: 600_000 })
    expect(parseOpenCodeEvents('{"type":"start"}\r\n\r\nnot-json\r\n{"type":"result"}')).toEqual([{ type: 'start' }, { type: 'result' }])
  })

  it('keeps debug diagnostics opt-in and separate from normal arguments', () => {
    expect(openCodeDiagnosticArgs(false)).toEqual([])
    expect(openCodeDiagnosticArgs(true)).toEqual(['--print-logs', '--log-level', 'DEBUG'])
  })
})
