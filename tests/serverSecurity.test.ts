import { describe, expect, it } from 'vitest'
import { daemonToken, isAllowedDaemonRequest, WORKER_START_TIMEOUT_MS } from '../src/local-api/server'

describe('daemon request boundary', () => {
  it('requires the per-launch token and strict local origins', () => {
    expect(isAllowedDaemonRequest('http://localhost:5173', daemonToken)).toBe(true)
    expect(isAllowedDaemonRequest('https://evil.invalid', daemonToken)).toBe(false)
    expect(isAllowedDaemonRequest('http://localhost:5173', 'wrong')).toBe(false)
  })

  it('bounds the worker-start phase', () => {
    expect(WORKER_START_TIMEOUT_MS).toBe(15_000)
  })
})
