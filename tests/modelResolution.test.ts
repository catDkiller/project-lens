import { describe, expect, it } from 'vitest'
import { resolveCompatibleModel } from '../src/app/modelResolution'
import { deriveLauncherState } from '../src/app/launcherState'

describe('account-compatible model resolution', () => {
  it('preserves a discovered saved model', () => expect(resolveCompatibleModel(['gpt-5.4-mini', 'gpt-5.4'], 'gpt-5.4')).toBe('gpt-5.4'))
  it('chooses the preferred discovered model when the saved value is absent', () => expect(resolveCompatibleModel(['gpt-5.6-sol', 'gpt-5.4-mini'], 'automatic')).toBe('gpt-5.4-mini'))
  it('requires a choice when discovery is empty', () => expect(resolveCompatibleModel([], undefined)).toBeUndefined())
  it('requires explicit selection when no preferred model is discovered', () => expect(resolveCompatibleModel(['gpt-5.6-sol'])).toBeUndefined())
  it('does not enable analysis for an undiscovered model', () => expect(deriveLauncherState({ status: 'ready', models: ['gpt-5.4-mini'] }, { kind: 'prepared' }, 'gpt-5.4').canAnalyse).toBe(false))
})
