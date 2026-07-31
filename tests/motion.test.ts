import { describe, expect, it } from 'vitest'
import { motion } from '../src/motion/tokens'

describe('motion system', () => {
  it('keeps restrained timing and movement tokens', () => {
    expect(motion.fast).toBeGreaterThanOrEqual(0.14)
    expect(motion.fast).toBeLessThanOrEqual(0.18)
    expect(motion.page).toBeLessThanOrEqual(0.42)
    expect(motion.distance).toBeLessThanOrEqual(14)
  })

  it('uses a GSAP media context for reduced-motion cleanup', async () => {
    const source = (await import('../src/motion/useEntranceMotion?raw')).default
    expect(source).toContain('gsap.matchMedia()')
    expect(source).toContain('media.revert()')
    expect(source).toContain('prefers-reduced-motion')
  })
})
