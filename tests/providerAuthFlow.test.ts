import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { applyProviderAvailability, canStartOpenCodeAnalysis, mapOpenCodeModels } from '../src/local-api/opencode'

describe('provider authentication flow', () => {
  it('keeps an OpenCode catalogue model disabled until auth output confirms its provider', () => {
    const catalogue = mapOpenCodeModels('opencode/deepseek-v4-flash-free')
    expect(canStartOpenCodeAnalysis(applyProviderAvailability(catalogue, [{ id: 'opencode', displayName: 'OpenCode', connected: false }])[0])).toBe(false)
    expect(canStartOpenCodeAnalysis(applyProviderAvailability(catalogue, [{ id: 'opencode', displayName: 'OpenCode', connected: true }])[0])).toBe(true)
  })

  it('uses a non-blocking tracked session with verification, cancellation, and no analysis launch', async () => {
    const server = await readFile(new URL('../src/local-api/server.ts', import.meta.url), 'utf8')
    const app = await readFile(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
    const launcher = await readFile(new URL('../src/app/Launcher.tsx', import.meta.url), 'utf8')
    expect(server).toContain("'waiting-for-user'")
    expect(server).toContain('verifyAuthSession')
    expect(server).toContain("session.status = 'cancelled'")
    expect(server).toContain("'terminal-closed-before-completion'")
    expect(app).toContain('auth-sessions/${id}')
    expect(launcher).toContain('Check connection')
    expect(launcher).toContain('Copy instructions')
    expect(launcher).toContain('Analysis stays disabled until it is confirmed.')
  })
})
