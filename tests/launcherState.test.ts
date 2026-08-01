import { describe, expect, it } from 'vitest'
import { deriveCanonicalLauncherState, deriveLauncherState } from '../src/app/launcherState'

const readyOpenCode = { id: 'opencode', displayName: 'OpenCode', installed: true, status: 'available' as const, readiness: 'ready' as const }
const unavailableCodex = { id: 'codex', displayName: 'Codex', installed: true, status: 'available' as const, readiness: 'unhealthy' as const }
const readyModel = { providerId: 'openrouter', modelId: 'model', fullId: 'openrouter/model', displayName: 'model', availability: 'ready' as const, runnable: true }

describe('release launcher state', () => {
  it('ignores an unavailable stored Codex preference and selects Ready OpenCode', () => {
    const state = deriveLauncherState([unavailableCodex, readyOpenCode], [readyModel], { kind: 'prepared' }, 'codex')
    expect(state.activeRuntime?.id).toBe('opencode')
    expect(state.execution?.fullId).toBe('openrouter/model')
    expect(state.canAnalyse).toBe(true)
  })

  it('keeps model execution attached to OpenCode and reports one disabled reason', () => {
    const state = deriveLauncherState([unavailableCodex], [readyModel], { kind: 'prepared' }, 'codex')
    expect(state.execution).toBeUndefined()
    expect(state.disabledReason).toBe('AI setup is required.')
    expect(state.privacyDescription).toContain('active AI engine')
  })

  it('uses explicit precedence for reading, source errors, engine and run states', () => {
    const base = { engine: { status: 'ready' as const }, runtimeSafetyReady: true }
    expect(deriveCanonicalLauncherState({ ...base, source: { status: 'empty' }, run: { status: 'idle' } }).view).toBe('EMPTY')
    expect(deriveCanonicalLauncherState({ ...base, source: { status: 'reading' }, run: { status: 'idle' } }).view).toBe('READING_SOURCE')
    expect(deriveCanonicalLauncherState({ ...base, source: { status: 'local-unsupported' }, run: { status: 'idle' } }).view).toBe('UNSUPPORTED_SOURCE')
    expect(deriveCanonicalLauncherState({ ...base, source: { status: 'prepared' }, run: { status: 'starting' } }).view).toBe('STARTING')
  })

  it('exposes exactly one concise reason and gates analysis on safety', () => {
    const state = deriveCanonicalLauncherState({ source: { status: 'prepared' }, engine: { status: 'ready' }, run: { status: 'idle' }, runtimeSafetyReady: false })
    expect(state.canAnalyse).toBe(false)
    expect(state.disabledReason).toBeTruthy()
    expect(state.privacyDescription).toContain('Relevant project text may be sent')
  })
})
