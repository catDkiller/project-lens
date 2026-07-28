import { useState } from 'react'
import { analysisStages, runProjectAnalysis } from '../analysis'
import type { AnalysisStageId, AnalysisStageStatus, ProjectAnalysis } from '../analysis'
import { AnalysisProgress } from './AnalysisProgress'
import { AnalysisWorkspace } from './AnalysisWorkspace'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import './app.css'

const initialStages = Object.fromEntries(analysisStages.map((stage) => [stage.id, 'pending'])) as Record<AnalysisStageId, AnalysisStageStatus>

export function App() {
  const [stages, setStages] = useState(initialStages)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  async function openPreparedSample() {
    setAnalysis(null)
    setError(null)
    setStages(initialStages)
    setIsRunning(true)

    try {
      const project = await bundledSampleProjectSource.load()
      const result = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (id, status) => {
        setStages((current) => ({ ...current, [id]: status }))
      }, 120)
      setAnalysis(result)
    } catch {
      setError('Project analysis could not finish. Please try the prepared sample again.')
    } finally {
      setIsRunning(false)
    }
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
          <button className="primary-action" type="button" onClick={openPreparedSample} disabled={isRunning}>
            {isRunning ? 'Analysing prepared sample…' : analysis ? 'Analyse prepared sample again' : 'Open prepared sample'}
          </button>
          <button className="secondary-action" type="button" disabled>
            Local folder — coming later
          </button>
        </div>

        <p className="source-note">
          The prepared React/Vite sample is ready now. GitHub repositories and local folders are planned
          sources, not part of this foundation.
        </p>

        {error && <p className="error-state" role="alert">{error}</p>}
      </section>

      {(isRunning || analysis || error) && <AnalysisProgress stages={stages} />}
      {analysis && <AnalysisWorkspace analysis={analysis} />}
    </main>
  )
}
