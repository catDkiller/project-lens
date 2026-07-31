import type { AnalysisEventDto } from '../local-api/contracts'

interface AnalysisProgressProps { projectName?: string; modelId?: string; events: AnalysisEventDto[]; failed?: string; onCancel: () => void; onRetry?: () => void; onChooseModel?: () => void }

export function AnalysisProgress({ projectName = 'project', modelId, events, failed, onCancel, onRetry, onChooseModel }: AnalysisProgressProps) {
  const latest = events.at(-1)
  const stages = [
    ['Prepare files', ['queued', 'preparing-evidence']],
    ['Understand structure', ['analysing']],
    ['Generate explanation', ['starting-agent']],
    ['Validate guide', ['validating', 'completed']],
  ] as const
  const isFailed = Boolean(failed)
  return <main className="analysis-screen"><section className="analysis-panel" aria-live="polite"><p className="eyebrow">Project Lens</p><h1>{isFailed ? 'Analysis needs attention' : `Understanding “${projectName}”`}</h1>{isFailed ? <div className="analysis-failure" role="alert"><h2>{failed}</h2><p>Nothing was changed in your project. Your selected folder and deterministic findings are still available.</p><div className="analysis-actions"><button className="launcher-analyse" type="button" onClick={onRetry}>Retry</button><button className="quiet-button" type="button" onClick={onChooseModel}>Choose another model</button></div></div> : <><div className="analysis-stages">{stages.map(([label, types]) => { const active = latest && (types as readonly string[]).includes(latest.type); const done = latest?.type === 'completed' || (types as readonly string[]).includes('queued') && events.some((event) => event.type === 'preparing-evidence'); return <div className={`analysis-stage-row${active ? ' active' : ''}${done ? ' done' : ''}`} key={label}><span aria-hidden="true">{done ? '✓' : active ? '●' : '○'}</span><strong>{label}</strong></div>})}</div><p className="analysis-current" role="status">{latest?.message ?? 'Preparing the analysis…'}</p><p className="analysis-model">Model: <code>{modelId ?? 'Selected model'}</code></p><div className="analysis-actions"><button className="quiet-button" type="button" onClick={onCancel}>Cancel</button></div></>}<details className="analysis-details"><summary>Activity details</summary><div className="analysis-history" role="log">{events.map((event, index) => <p key={`${event.timestamp ?? index}-${index}`}><time>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</time>{event.message ?? event.type}{event.path ? ` · ${event.path}` : ''}</p>)}</div></details></section></main>
}
