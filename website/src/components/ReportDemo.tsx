import { useState } from 'react'
import { demoReport } from '../content/demoReport'

export function ReportDemo() {
  const [view, setView] = useState<'overview' | 'guide'>('overview')
  const report = demoReport[view]

  return <section className="report-demo reveal" id="report" aria-labelledby="report-title">
    <div className="section-intro">
      <p className="eyebrow">Product interface preview</p>
      <h2 id="report-title">Two ways to read the same project.</h2>
      <p>Overview builds the mental model quickly. Complete Guide stays with the details when you need them.</p>
    </div>
    <div className="report-shell">
      <nav aria-label="Product preview views">
        <button className={view === 'overview' ? 'selected' : ''} aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Overview</button>
        <button className={view === 'guide' ? 'selected' : ''} aria-pressed={view === 'guide'} onClick={() => setView('guide')}>Complete Guide</button>
      </nav>
      <article>
        <p className="report-kicker">{view === 'overview' ? 'Orientation' : 'Technical depth'}</p>
        <h3>{report.title}</h3>
        <p className="report-summary">{report.copy}</p>
        {view === 'overview'
          ? <div className="report-areas">{demoReport.overview.items.map((item) => <section key={item.title}><h4>{item.title}</h4><p>{item.detail}</p></section>)}</div>
          : <ol className="guide-list">{demoReport.guide.items.map((item) => <li key={item}>{item}</li>)}</ol>}
        <details><summary>How explanations stay grounded</summary><p>Each explanation points back to relevant files and clearly labels uncertainty. This preview is conceptual product content, not a live project report.</p></details>
      </article>
    </div>
  </section>
}
