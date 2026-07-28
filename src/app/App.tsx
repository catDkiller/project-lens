import { useState } from 'react'
import { analysisStages, runProjectAnalysis } from '../analysis'
import type { AnalysisStageId, AnalysisStageStatus, ProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import { AnalysisProgress } from './AnalysisProgress'
import { AnalysisWorkspace } from './AnalysisWorkspace'
import './app.css'

const initialStages = Object.fromEntries(analysisStages.map((stage) => [stage.id, 'pending'])) as Record<AnalysisStageId, AnalysisStageStatus>

export function App() {
  const [stages, setStages] = useState(initialStages)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  async function openPreparedSample() {
    setError(null)
    setStages(initialStages)
    setIsRunning(true)
    try {
      const project = await bundledSampleProjectSource.load()
      setAnalysis(await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (id, status) => setStages((current) => ({ ...current, [id]: status })), 120))
    } catch {
      setError('Project analysis could not finish. Please try the prepared sample again.')
    } finally {
      setIsRunning(false)
    }
  }

  function restart() {
    setAnalysis(null)
    setError(null)
    setStages(initialStages)
  }

  if (analysis) return <AnalysisWorkspace analysis={analysis} learningPacks={preparedSampleLearningPacks} onRestart={restart} />

  return <main className="start-screen"><section aria-labelledby="product-name"><h1 id="product-name">Project Lens</h1><p>Browse a software project’s structure, implementation choices, and learning priorities.</p><div className="start-actions"><button className="primary-action" type="button" onClick={openPreparedSample} disabled={isRunning}>Try prepared sample</button><button className="secondary-action" type="button" disabled>Open local project — coming soon</button></div>{isRunning && <AnalysisProgress stages={stages} />}{error && <p className="error-state" role="alert">{error}</p>}</section></main>
}
