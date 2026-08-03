import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuideNavigation } from '../src/app/KnowledgeWorkspace'
import { readFileSync } from 'node:fs'

describe('guide navigation contract', () => {
  it('renders stable links for any supplied guide sections', () => {
    const markup = renderToStaticMarkup(<GuideNavigation items={[{ id: 'report-overview', label: 'Overview' }, { id: 'report-optional', label: 'Optional notes' }]} />)
    expect(markup).toContain('href="#report-overview"')
    expect(markup).toContain('href="#report-optional"')
    expect(markup).toContain('Guide contents')
    expect(markup).toContain('guide-contents-scroll')
  })

  it('keeps guide anchors below the measured sticky header and prevents wrapping', () => {
    const css = readFileSync(new URL('../src/app/app.css', import.meta.url), 'utf8')
    expect(css).toContain('scroll-margin-top: var(--guide-anchor-offset)')
    expect(css).toContain('top: var(--guide-header-height, 3.25rem)')
    expect(css).toContain('flex-wrap: nowrap')
    expect(css).toContain('overflow-x: auto')
  })
})
