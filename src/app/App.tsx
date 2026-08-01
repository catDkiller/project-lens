import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalysisEventDto, AnalysisRunStatusDto, CodexStatusDto } from '../local-api/contracts'
import type { PresentationKnowledgeBase } from '../knowledge'
import type { ProjectFile } from '../project-sources/types'
import type { LocalSkipReason } from '../project-sources/localFolderImport'
import { ReleaseLauncher } from './ReleaseLauncher'
import { deriveLauncherState } from './launcherState'
import { AnalysisProgress } from './AnalysisProgress'
import { KnowledgeWorkspace } from './KnowledgeWorkspace'
import type { Accent, Appearance } from './ThemeMenu'
import './app.css'

type Local = { name: string; files: ProjectFile[]; summary: string; skipped: Record<LocalSkipReason, number>; support: 'supported' | 'unsupported' | 'too-large' | 'failed'; diagnostics?: string[] }
export function App() {
  const [mode, setMode] = useState<'launcher' | 'analysing' | 'failed' | 'workspace'>('launcher'); const [codex, setCodex] = useState<CodexStatusDto>(); const [token, setToken] = useState<string>(); const [local, setLocal] = useState<Local>(); const [prepared, setPrepared] = useState(false); const [reading, setReading] = useState(false); const [runId, setRunId] = useState<string>(); const [events, setEvents] = useState<AnalysisEventDto[]>([]); const [status, setStatus] = useState<AnalysisRunStatusDto>(); const [startedAt, setStartedAt] = useState<number>(); const [error, setError] = useState<string>(); const [knowledge, setKnowledge] = useState<PresentationKnowledgeBase>(); const [appearance, setAppearance] = useState<Appearance>('dark'); const [accent, setAccent] = useState<Accent>('blue'); const started = useRef(false)
  const api = useCallback((url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { ...init.headers, ...(token ? { 'x-project-lens-token': token } : {}) } }), [token])
  const refresh = useCallback(async () => { try { const health = await fetch('/api/runtime/health').then((response) => response.json() as Promise<{ token: string }>); setToken(health.token); const response = await fetch('/api/codex/status', { headers: { 'x-project-lens-token': health.token } }); setCodex(await response.json() as CodexStatusDto) } catch { setCodex({ status: 'unavailable', error: 'Project Lens could not reach its local service.' }) } }, [])
  useEffect(() => { if (!started.current) { started.current = true; void refresh() } }, [refresh])
  useEffect(() => { if (!runId) return; const controller = new AbortController(); const timer = window.setInterval(() => { void api(`/api/analysis/${runId}`, { signal: controller.signal }).then(async (response) => { if (response.ok) setStatus(await response.json() as AnalysisRunStatusDto) }) }, 3000); return () => { controller.abort(); clearInterval(timer) } }, [api, runId])
  const source = local ? { kind: 'local' as const, name: local.name, summary: local.summary, support: local.support, diagnostics: local.diagnostics } : prepared ? { kind: 'prepared' as const } : undefined
  const state = deriveLauncherState(codex, source, reading)
  function usePrepared() { setLocal(undefined); setPrepared(true); setError(undefined) }
  function importLocal(name: string, files: ProjectFile[], summary: string, skipped: Record<LocalSkipReason, number>, support: Local['support'], diagnostics?: string[]) { setPrepared(false); setLocal({ name, files, summary, skipped, support, diagnostics }); setError(undefined) }
  async function analyse() { if (!state.canAnalyse) return; setMode('analysing'); setStartedAt(Date.now()); setEvents([]); setError(undefined); const response = await api(local ? '/api/analysis/local' : '/api/analysis/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(local ? { name: local.name, files: local.files } : {}) }); const payload = await response.json() as { runId?: string; error?: string }; if (!response.ok || !payload.runId) { setError(payload.error ?? 'Analysis could not start.'); setMode('failed'); return } setRunId(payload.runId); const stream = new EventSource(`/api/analysis/${payload.runId}/events?token=${encodeURIComponent(token ?? '')}`); for (const type of ['queued', 'preparing-evidence', 'starting-agent', 'analysing', 'validating', 'repairing', 'completed', 'failed', 'cancelled']) stream.addEventListener(type, (message) => { const event = JSON.parse((message as MessageEvent).data) as AnalysisEventDto; setEvents((current) => [...current, event]); if (event.type === 'completed' && event.result) { stream.close(); setKnowledge(event.result); setMode('workspace'); setRunId(undefined) } if (event.type === 'failed' || event.type === 'cancelled') { stream.close(); setError(event.error ?? 'Analysis failed.'); setMode('failed'); setRunId(undefined) } }) }
  const cancel = () => { if (runId) void api(`/api/analysis/${runId}/cancel`, { method: 'POST' }) }
  if (mode === 'workspace' && knowledge) return <KnowledgeWorkspace knowledge={knowledge} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onReturn={() => { setKnowledge(undefined); setMode('launcher') }} onReanalyse={analyse} />
  if (mode === 'analysing' || mode === 'failed') return <AnalysisProgress projectName={local?.name ?? 'Prepared Vite sample'} events={events} startedAt={startedAt} runState={status?.state} lastAnyEventAt={status?.lastAnyEventAt} lastGenuineAgentEventAt={status?.lastGenuineAgentEventAt} failed={mode === 'failed' ? error : undefined} onCancel={cancel} onRetry={analyse} onReturn={() => setMode('launcher')} />
  return <ReleaseLauncher state={state} onUsePrepared={usePrepared} onImportLocal={importLocal} onSourceReading={setReading} onAnalyse={analyse} />
}
