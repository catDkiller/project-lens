import { useEffect, useState } from 'react'
import type { AnalysisEventDto } from '../local-api/contracts'

interface Props { projectName: string; events: AnalysisEventDto[]; startedAt?: number; runState?: string; lastAnyEventAt?: string; lastGenuineAgentEventAt?: string; failed?: string; onRetry: () => void; onReturn: () => void; onCancel: () => void }

export function AnalysisProgress({ projectName, events, startedAt = Date.now(), failed, onRetry, onReturn, onCancel }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const latest = events.at(-1)
  const elapsed = Math.floor((now - startedAt) / 1000)
  return <main className="analysis-screen"><section className="analysis-panel" aria-live="polite"><p className="eyebrow">Project Lens</p><h1>{failed ? 'Analysis needs attention' : `Understanding “${projectName}”`}</h1>{failed ? <><p className="analysis-failure">{failed}</p><button className="launcher-analyse" type="button" onClick={onRetry}>Try again</button><button className="quiet-button" type="button" onClick={onReturn}>Return to project</button></> : <><p className="analysis-current">{latest?.message ?? 'Preparing the isolated snapshot.'}</p><p className="analysis-meta">Elapsed: {elapsed}s</p><button className="quiet-button" type="button" onClick={onCancel}>Cancel analysis</button></>}<details className="analysis-details"><summary>Activity details</summary>{events.map((event, index) => <p key={`${event.timestamp}-${index}`}>{event.message ?? event.type}</p>)}</details></section></main>
}
