import { describe, expect, it } from 'vitest'
import { mergeRunEvents } from '../src/app/runRecovery'

describe('run recovery polling', () => {
  it('hydrates missed SSE events in sequence order without duplicates', () => {
    const current = [{ id: '1', sequence: 1, type: 'queued' as const, message: 'queued' }]
    const incoming = [{ id: '2', sequence: 2, type: 'status' as const, message: 'worker started' }, current[0]]
    expect(mergeRunEvents(current, incoming).map((event) => event.sequence)).toEqual([1, 2])
  })
})
