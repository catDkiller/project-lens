import { describe, expect, it } from 'vitest'
import { demoReport } from './demoReport'

describe('public demo report', () => {
  it('contains clean relative evidence paths only', () => {
    expect(demoReport.areas.every(({ file }) => !file.startsWith('source/') && !file.includes('\\'))).toBe(true)
  })
})
