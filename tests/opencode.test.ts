import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analysisEnvironment, analysisPermissionConfig, applyProviderAvailability, buildAnalysisArgs, buildAnalysisCacheBasis, buildAnalysisCacheKey, buildProjectRequestFile, canStartOpenCodeAnalysis, classifyDatabaseDiagnostic, classifyModelCost, classifyOpenCodeFailure, extractOpenCodeText, freeModelIds, inspectOpenCodeDatabase, isSafeAnalysisConfig, mapOpenCodeModels, mapOpenCodeProviders, OPEN_CODE_RUN_PROMPT, OPEN_CODE_TIMEOUTS, openCodeDiagnosticArgs, openCodeFailureMessage, OpenCodeFailureError, OpenCodeTimeoutError, parseOpenCodeEvents, redact, resolveOpenCodeExecutable, sanitizeResearchMetadata, stripTerminalControl, validateOpenCodeCompatibility } from '../src/local-api/opencode'
import { createOpenCodeAgent } from '../src/agents'
import { createProjectKnowledgeBase } from '../src/knowledge'
import { runProjectAnalysis } from '../src/analysis'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'

describe('OpenCode local adapter', () => {
  it('does not hardcode models and maps OpenCode output', () => {
    expect(mapOpenCodeModels('provider-a/fast\nprovider-b/careful\nprovider-a/fast\n')).toEqual([
      { providerId: 'provider-a', modelId: 'fast', fullId: 'provider-a/fast', displayName: 'fast', availability: 'available', cost: 'usage-priced', free: false, local: false },
      { providerId: 'provider-b', modelId: 'careful', fullId: 'provider-b/careful', displayName: 'careful', availability: 'available', cost: 'usage-priced', free: false, local: false },
    ])
  })

  it('parses connected providers without credential values', async () => {
    const { mapOpenCodeProviders } = await import('../src/local-api/opencode')
    const providers = mapOpenCodeProviders('• Google api\n• OpenRouter env\n', ['ollama'])
    expect(providers).toEqual([{ id: 'google', displayName: 'Google', connected: true, connectionMethod: 'api' }, { id: 'ollama', displayName: 'ollama', connected: false }, { id: 'openrouter', displayName: 'OpenRouter', connected: true, connectionMethod: 'env' }])
    expect(JSON.stringify(providers)).not.toContain('key')
  })

  it('uses an isolated read-only permission configuration with optional web research', () => {
    expect(isSafeAnalysisConfig()).toBe(true)
    expect(analysisPermissionConfig(true).permission).toMatchObject({ '*': 'deny', read: 'allow', list: 'allow', glob: 'allow', grep: 'allow', edit: 'deny', bash: 'deny', webfetch: 'allow', websearch: 'allow', task: 'deny', external_directory: 'deny' })
    expect(analysisPermissionConfig(false).permission).toMatchObject({ webfetch: 'deny', websearch: 'deny' })
    expect(JSON.parse(analysisEnvironment({}, true).OPENCODE_CONFIG_CONTENT!)).toEqual(analysisPermissionConfig(true))
    expect(analysisEnvironment({}, true).OPENCODE_ENABLE_EXA).toBe('1')
    expect(analysisEnvironment({}, false).OPENCODE_ENABLE_EXA).toBeUndefined()
    expect(analysisEnvironment({}, true).OPENCODE_DISABLE_CLAUDE_CODE).toBe('1')
    expect(analysisEnvironment({}, true).OPENCODE_DISABLE_AUTOUPDATE).toBe('1')
  })

  it('lists only IDs explicitly marked free', () => {
    expect(freeModelIds(mapOpenCodeModels('provider/free:free\nprovider/unknown\n'))).toEqual(['provider/free:free'])
  })

  it('classifies cost from the exact suffix without guessing from names', () => {
    expect(classifyModelCost('openrouter/deepseek/deepseek-v4-flash:free')).toBe('explicit-free')
    expect(classifyModelCost('provider/free-model')).toBe('usage-priced')
    expect(classifyModelCost('provider/model', 'unknown')).toBe('unknown')
    expect(mapOpenCodeModels('provider/free-model\nprovider/model:free')[0].cost).toBe('usage-priced')
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
    expect(model).toMatchObject({ availability: 'ready', readiness: 'ready', catalogued: true, providerConnected: true, explicitlyFree: false, runnable: true })
    expect(canStartOpenCodeAnalysis(model)).toBe(true)
  })

  it('keeps catalogue and readiness separate for setup-required providers', () => {
    const [model] = applyProviderAvailability(mapOpenCodeModels('opencode/deepseek:free'), [{ id: 'opencode', displayName: 'OpenCode', connected: false }])
    expect(model).toMatchObject({ catalogued: true, providerConnected: false, readiness: 'setup-required', readinessReason: 'Connect this provider in OpenCode first.', explicitlyFree: true })
    expect(canStartOpenCodeAnalysis(model)).toBe(false)
  })

  it('maps known failures to specific, safe recovery categories', () => {
    expect(classifyOpenCodeFailure(new OpenCodeFailureError('provider-authentication-required', 'Connect OpenCode to use this model.'))).toBe('provider-authentication-required')
    expect(classifyOpenCodeFailure(new Error('429 rate limit reached'))).toBe('free-quota-or-rate-limit')
    expect(classifyOpenCodeFailure(new Error('Unknown model'))).toBe('model-unavailable')
    expect(classifyOpenCodeFailure(new Error('Unknown option --agent'))).toBe('invalid-opencode-arguments')
    expect(classifyOpenCodeFailure(new Error('database is locked'))).toBe('opencode-database-busy')
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
    expect(stripTerminalControl('\u001b[91m\u001b[1mError:\u001b[0m database is locked')).toBe('Error: database is locked')
  })

  it('uses a short positional prompt and an attached request file', () => {
    const args = buildAnalysisArgs('google/gemini-2.5-pro', 'C:/temp/workspace', 'C:/temp/workspace/.project-lens-request.json')
    expect(args).toEqual(['run', OPEN_CODE_RUN_PROMPT, '--format', 'json', '--agent', 'plan', '--model', 'google/gemini-2.5-pro', '--dir', 'C:/temp/workspace', '--file', 'C:/temp/workspace/.project-lens-request.json'])
  })

  it('builds a versioned request file with schema, evidence, limitations, and web preference', async () => {
    const analysis = await runProjectAnalysis(preparedViteSample, preparedSampleFeatureDefinitions, () => {})
    const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks)
    const request = JSON.parse(buildProjectRequestFile(raw, true)) as Record<string, unknown>
    expect(request).toMatchObject({
      schemaMarker: 'project-lens-request-v1',
      promptVersion: '1.0',
      explanationSchema: 'PresentationKnowledgeBase',
      webResearchPreference: 'enabled',
    })
    expect(Array.isArray(request.evidenceIds)).toBe(true)
    expect(Array.isArray(request.projectLimitations)).toBe(true)
    expect(sanitizeResearchMetadata('C:\\secret\\path\napi_key=abc123')).not.toContain('\n')
  })

  it('builds a cache basis from project, agent, model, variant, and prompt version', () => {
    const basis = buildAnalysisCacheBasis({ id: 'local-demo', name: 'Local demo' }, 'opencode', 'opencode/deepseek-v4-flash-free', 'sample')
    expect(basis).toContain('"projectId":"local-demo"')
    expect(basis).toContain('"agentId":"opencode"')
    expect(basis).toContain('"modelId":"opencode/deepseek-v4-flash-free"')
    expect(basis).toContain('"promptVersion":"1.0"')
    expect(buildAnalysisCacheKey({ id: 'local-demo', name: 'Local demo' }, 'opencode', 'opencode/deepseek-v4-flash-free', 'sample')).toHaveLength(64)
  })

  it('uses phase-aware timeout defaults and parses fragmented-safe NDJSON lines', () => {
    expect(OPEN_CODE_TIMEOUTS).toEqual({ processStartMs: 30_000, firstResponseMs: 240_000, inactivityMs: 120_000, totalRunMs: 600_000 })
    expect(parseOpenCodeEvents('{"type":"start"}\r\n\r\nnot-json\r\n{"type":"result"}')).toEqual([{ type: 'start' }, { type: 'result' }])
  })

  it('reports database sidecars without modifying them', async () => {
    const result = await inspectOpenCodeDatabase(path.join(process.cwd(), 'missing-opencode-db'))
    expect(result.warnings).toEqual([])
  })
  it('classifies database diagnostics without taking corrective action', () => {
    expect(classifyDatabaseDiagnostic('SQLITE_BUSY: database is locked')).toBe('busy')
    expect(classifyDatabaseDiagnostic('database disk image is malformed')).toBe('corrupt')
  })
  it('fails closed for unknown OpenCode versions before model use', () => {
    expect(() => validateOpenCodeCompatibility('9.9.9', 'run --format json --agent plan --model --dir --file')).toThrow(/does not support/)
  })

  it('keeps debug diagnostics opt-in and separate from normal arguments', () => {
    expect(openCodeDiagnosticArgs(false)).toEqual([])
    expect(openCodeDiagnosticArgs(true)).toEqual(['--print-logs', '--log-level', 'DEBUG'])
  })

  it('exposes the generic OpenCode adapter contract and capabilities', async () => {
    const agent = createOpenCodeAgent()
    expect(agent.id).toBe('opencode')
    expect(agent.capabilities).toMatchObject({ projectRead: true, webSearch: true, webFetch: true, structuredOutput: true, readOnlyEnforcement: true })
    expect(agent.readiness).toBe('unavailable')
    expect(typeof agent.healthCheck).toBe('function')
  })
})
