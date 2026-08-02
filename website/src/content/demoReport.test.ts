import { describe, expect, it } from 'vitest'
import { demoReport } from './demoReport'

describe('public demo content', () => {
  it('provides the intended two reading depths', () => {
    const publicCopy = JSON.stringify(demoReport)
    expect(publicCopy).toContain('mental model')
    expect(demoReport.overview.items).toHaveLength(4)
    expect(demoReport.guide.items).toHaveLength(5)
  })
})
