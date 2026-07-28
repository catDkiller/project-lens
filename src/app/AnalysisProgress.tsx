import { analysisStages } from '../analysis'
import type { AnalysisStageId, AnalysisStageStatus } from '../analysis'

interface AnalysisProgressProps {
  stages: Record<AnalysisStageId, AnalysisStageStatus>
}

export function AnalysisProgress({ stages }: AnalysisProgressProps) {
  return (
    <section className="analysis-progress" aria-labelledby="analysis-progress-heading" aria-live="polite">
      <p id="analysis-progress-heading">Analysing project…</p>
      <details>
        <summary>Analysis details</summary>
        <ol className="stage-list">{analysisStages.map((stage) => <li key={stage.id}>{stage.label}: {stages[stage.id]}</li>)}</ol>
      </details>
    </section>
  )
}
