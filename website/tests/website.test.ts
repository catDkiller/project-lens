import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

describe('public website replacement', () => {
  it('is a standalone Project Lens prototype page', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8')
    expect(html).toContain('See the system')
    expect(html).toContain('Project Lens turns unfamiliar repositories')
    expect(html).toContain('Complete Guide')
    expect(html).not.toContain('open-design-ui-prototype')
    expect(html).not.toContain('D:\\hackathon-project')
  })

  it('keeps required public sections and no old media dependency', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8')
    expect(html).toContain('Evidence first')
    expect(html).toContain('Built with Codex')
    expect(html).toContain('Local-first limits')
    expect(html).not.toContain('project-lens-sea.mp4')
  })

  it('keeps the demo placeholder honest and configurable', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8')
    const config = await readFile(path.join(root, 'vite.config.ts'), 'utf8')
    expect(html).toContain('See Project Lens in action')
    expect(html).toContain('demo-placeholder')
    expect(html).toContain('preload=\'metadata\'')
    expect(config).toContain('VITE_DEMO_VIDEO_URL')
    expect(config).toContain('project-lens-demo.mp4')
  })

  it('normalizes wheel input without section-index snapping', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8')
    expect(html).toContain('deltaMode===1')
    expect(html).toContain('deltaMode===2')
    expect(html).toContain('INPUT.wheelWindowMs')
    expect(html).toContain('INPUT.maxVelocity')
    expect(html).not.toContain('go(clamp(closest()+direction,0,N-1))')
  })
})
