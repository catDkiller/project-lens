import { useEffect, useState } from 'react'
import type { AnalysisEventDto } from '../local-api/contracts'

interface AnalysisProgressProps {
  projectName?: string
  modelId?: string
  events: AnalysisEventDto[]
  startedAt?: number
  runState?: string
  lastAnyEventAt?: string
  lastGenuineAgentEventAt?: string
  cancelling?: boolean
  failed?: string
  onCancel: () => void
  onRetry?: () => void
  onChooseModel?: () => void
  onConnectOpenCode?: () => void
  onCheckReadiness?: () => void
}

function formatDuration(milliseconds: number) { const seconds = Math.floor(milliseconds / 1000); return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s` }
function webResearchLabel(value?: string) {
  if (value === 'used-successfully') return 'Documentation was used.'
  if (value === 'attempted-but-unavailable') return 'Documentation was unavailable; project-only analysis completed.'
  if (value === 'failed') return 'Documentation failed; project-only analysis completed.'
  if (value === 'configured') return 'Documentation was configured.'
  if (value === 'not-requested') return 'Documentation was not needed.'
  return ''
}

export function AnalysisProgress({ projectName = 'project', modelId, events, startedAt = Date.now(), runState, lastAnyEventAt, lastGenuineAgentEventAt, cancelling = false, failed, onCancel, onRetry, onChooseModel, onConnectOpenCode, onCheckReadiness }: AnalysisProgressProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const latest = events.at(-1)
  const elapsed = Math.max(0, now - startedAt)
  const lastAny = lastAnyEventAt ? new Date(lastAnyEventAt).getTime() : latest?.timestamp ? new Date(latest.timestamp).getTime() : startedAt
  const lastAgent = lastGenuineAgentEventAt ? new Date(lastGenuineAgentEventAt).getTime() : undefined
  const sinceLastAny = Math.max(0, now - lastAny)
  const sinceLastAgent = lastAgent ? Math.max(0, now - lastAgent) : undefined
  const stalled = !failed && !cancelling && sinceLastAny >= 120_000
  const connectionRequired = latest?.diagnostic?.code === 'provider-authentication-required'
  const databaseBusy = latest?.diagnostic?.code === 'opencode-database-busy'
  const stages = [['Prepare files', ['queued', 'preparing-evidence']], ['Understand structure', ['analysing']], ['Generate explanation', ['starting-agent']], ['Validate guide', ['validating', 'completed']]] as const
  const details = <details className="analysis-details"><summary>Activity details</summary><div className="analysis-history" role="log">
    {events.length ? events.map((event, index) => <p key={`${event.timestamp ?? index}-${index}`}><time>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</time>{event.message ?? event.type}{event.path ? ` · ${event.path}` : ''}</p>) : <p>No response has been received from OpenCode yet.</p>}
    {latest?.diagnostic && <dl className="analysis-diagnostics"><dt>Diagnostic code</dt><dd>{latest.diagnostic.code ?? 'runtime'}</dd>{latest.diagnostic.exitCode !== undefined && <><dt>Exit code</dt><dd>{latest.diagnostic.exitCode ?? 'not available'}</dd></>}{latest.diagnostic.timeoutType && <><dt>Timeout type</dt><dd>{latest.diagnostic.timeoutType}</dd></>}{latest.diagnostic.webResearchOutcome && <><dt>Web research</dt><dd>{webResearchLabel(latest.diagnostic.webResearchOutcome)}</dd></>}{latest.diagnostic.webResearchSource && <><dt>Web source</dt><dd>{latest.diagnostic.webResearchSource.title} · {latest.diagnostic.webResearchSource.url}</dd></>}{latest.diagnostic.stderr && <><dt>Runtime detail</dt><dd>{latest.diagnostic.stderr}</dd></>}</dl>}
  </div></details>
  const timing = <p className="analysis-meta">Elapsed: {formatDuration(elapsed)} · Since Project Lens activity: {formatDuration(sinceLastAny)} · OpenCode response: {sinceLastAgent === undefined ? 'none received' : `${formatDuration(sinceLastAgent)} ago`}</p>
  if (failed) return <main className="analysis-screen"><section className="analysis-panel" aria-live="polite"><p className="eyebrow">Project Lens</p><h1>{databaseBusy ? 'OpenCode is busy' : 'Analysis needs attention'}</h1><div className="analysis-failure" role="alert"><h2>{failed}</h2><p>{databaseBusy ? 'Another OpenCode session may currently be using its local database. Project Lens will not close or interfere with other OpenCode sessions.' : connectionRequired ? 'This model is provided through OpenCode and needs an authenticated OpenCode provider before it can run.' : 'Nothing was changed in your project. Your selected folder and deterministic findings are still available.'}</p><p className="analysis-meta">Stopped at: {latest?.message ?? 'starting the analysis'} · Elapsed: {formatDuration(elapsed)} · Last OpenCode response: {sinceLastAgent === undefined ? 'none received' : `${formatDuration(sinceLastAgent)} ago`}</p><p className="analysis-model">Model: <code>{modelId ?? 'Selected model'}</code>{latest?.diagnostic?.timeoutType ? ` · Timeout: ${latest.diagnostic.timeoutType}` : ''}</p><div className="analysis-actions">{databaseBusy && onCheckReadiness ? <button className="launcher-analyse" type="button" onClick={onCheckReadiness}>Check again</button> : connectionRequired && onConnectOpenCode ? <button className="launcher-analyse" type="button" onClick={onConnectOpenCode}>Connect through OpenCode</button> : <button className="launcher-analyse" type="button" onClick={onRetry}>Retry</button>}<button className="quiet-button" type="button" onClick={onChooseModel}>Choose another model</button></div></div>{details}</section></main>
  return <main className="analysis-screen"><section className="analysis-panel" aria-live="polite"><p className="eyebrow">Project Lens</p><h1>Understanding &quot;{projectName}&quot;</h1><div className="analysis-stages">{stages.map(([label, types]) => { const active = latest && (types as readonly string[]).includes(latest.type); const done = latest?.type === 'completed' || (types as readonly string[]).includes('queued') && events.some((event) => event.type === 'preparing-evidence'); return <div className={`analysis-stage-row${active ? ' active' : ''}${done ? ' done' : ''}`} key={label}><span aria-hidden="true">{done ? '✓' : active ? '●' : '○'}</span><strong>{label}</strong></div> })}</div><p className="analysis-current" role="status">{latest?.message ?? 'Preparing the analysis...'}</p>{stalled && <p className="analysis-stalled" role="status">No response has been received from OpenCode yet.</p>}{runState === 'cancelling' && <p className="analysis-stalled" role="status">Cancelling... Waiting for the owned OpenCode process to exit.</p>}{timing}<p className="analysis-model">Model: <code>{modelId ?? 'Selected model'}</code>{runState ? ` · State: ${runState}` : ''}</p><div className="analysis-actions"><button className="quiet-button" type="button" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel'}</button></div>{details}</section></main>
}
