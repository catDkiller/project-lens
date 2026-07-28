import { useState } from 'react'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import type { NormalizedProject } from '../project-sources/types'
import './app.css'

export function App() {
  const [openedProject, setOpenedProject] = useState<NormalizedProject | null>(null)

  async function openPreparedSample() {
    setOpenedProject(await bundledSampleProjectSource.load())
  }

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="product-name">
        <p className="eyebrow">Codex-built learning workspace</p>
        <h1 id="product-name">Project Lens</h1>
        <p className="statement">
          Understand the React projects coding agents build before you decide what to learn next.
        </p>
      </section>

      <section className="source-panel" aria-labelledby="source-heading">
        <div>
          <p className="eyebrow">Start with a project</p>
          <h2 id="source-heading">Choose a source</h2>
        </div>

        <div className="source-actions">
          <button className="primary-action" type="button" onClick={openPreparedSample}>
            Open prepared sample
          </button>
          <button className="secondary-action" type="button" disabled>
            Local folder — coming later
          </button>
        </div>

        <p className="source-note">
          The prepared React/Vite sample is ready now. GitHub repositories and local folders are planned
          sources, not part of this foundation.
        </p>

        {openedProject && (
          <p className="ready-state" role="status">
            {openedProject.name} is loaded and ready for analysis.
          </p>
        )}
      </section>
    </main>
  )
}
