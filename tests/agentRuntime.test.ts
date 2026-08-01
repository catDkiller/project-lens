import { describe, expect, it } from 'vitest'
import { createCodexRuntime } from '../src/agents/codexAdapter'
import type { AgentRuntime } from '../src/agents/types'

describe('generic agent runtime', () => {
  it('exposes the replaceable runtime contract without requiring a model request', async () => {
    const runtime = createCodexRuntime()
    expect(runtime.id).toBe('codex')
    expect(runtime.capabilities.readOnlyEnforcement).toBe(true)
    expect(runtime).toMatchObject({ detect: expect.any(Function), checkAuthentication: expect.any(Function), checkReadiness: expect.any(Function), runAnalysis: expect.any(Function), cancel: expect.any(Function), normalizeEvents: expect.any(Function) })
    const detected = await runtime.detect()
    expect(['ready', 'sign-in-required', 'installed-but-unavailable', 'not-installed', 'incompatible']).toContain(detected.readiness)
  })

  it('keeps agent selection separate from provider and model identities', () => {
    const runtime: AgentRuntime = createCodexRuntime()
    expect(runtime.id).toBe('codex')
    expect(runtime).not.toHaveProperty('providerId')
    expect(runtime).not.toHaveProperty('modelId')
  })
})

