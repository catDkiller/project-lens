import { analysisStages } from '../analysis'
import type { AnalysisStageId, AnalysisStageStatus } from '../analysis'

interface AnalysisProgressProps {
  stages: Record<AnalysisStageId, AnalysisStageStatus>
}

export function AnalysisProgress({ stages }: AnalysisProgressProps) {
  return (
    <section className="analysis-progress" aria-labelledby="analysis-progress-heading" aria-live="polite">
      <p className="eyebrow">Analysis activity</p>
      <h2 id="analysis-progress-heading">Reading the project structure</h2>
      <ol className="stage-list">
        {analysisStages.map((stage) => (
          <li key={stage.id} className={`stage stage-${stages[stage.id]}`}>
            <span>{stage.label}</span>
            <strong>{stages[stage.id]}</strong>
          </li>
        ))}
      </ol>
    </section>
  )
}
