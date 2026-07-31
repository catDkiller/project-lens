import { useEffect, useState } from 'react'
import { analysisStages, runProjectAnalysis } from '../analysis'
import type { AnalysisStageId, ProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { createProjectKnowledgeBase, createPresentationFallback, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import { preparedSamplePresentationKnowledge } from '../fixtures/preparedSamplePresentationKnowledge'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import { localFolderProjectSource } from '../project-sources/LocalFolderProjectSource'
import type { ProjectFile } from '../project-sources/types'
import type { LocalSkipReason } from '../project-sources/localFolderImport'
import type { AgentStatusDto, AnalysisEventDto, AnalysisRunStatusDto, ModelDto, ProviderAuthSessionDto, ProviderDto } from '../local-api/contracts'
import { Launcher } from './Launcher'
import { AnalysisProgress } from './AnalysisProgress'
import { KnowledgeWorkspace } from './KnowledgeWorkspace'
import type { Accent, Appearance } from './ThemeMenu'
import './app.css'

type AppMode = 'launcher' | 'analysing' | 'failed' | 'workspace'

export function App() {
  const [mode, setMode] = useState<AppMode>('launcher')
  const [knowledge, setKnowledge] = useState<PresentationKnowledgeBase | null>(null)
  const [error, setError] = useState<string>()
  const [analysisStage, setAnalysisStage] = useState<AnalysisStageId>()
  const [agent, setAgent] = useState<AgentStatusDto>()
  const [models, setModels] = useState<ModelDto[]>([])
  const [providers, setProviders] = useState<ProviderDto[]>([])
  const [authSession, setAuthSession] = useState<ProviderAuthSessionDto>()
  const [runtimeStatus, setRuntimeStatus] = useState('Checking local runtime…')
  const [runId, setRunId] = useState<string>()
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisEventDto[]>([])
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number>()
  const [runStatus, setRunStatus] = useState<AnalysisRunStatusDto>()
  const [cancelling, setCancelling] = useState(false)
  const [lastModel, setLastModel] = useState<string>()
  const [projectNotice, setProjectNotice] = useState<string>()
  const [localProject, setLocalProject] = useState<{ name: string; id: string; files: ProjectFile[]; summary: string; skipped: Record<LocalSkipReason, number> }>()
  const [appearance, setAppearance] = useState<Appearance>(() => typeof localStorage === 'undefined' ? 'dark' : localStorage.getItem('project-lens-appearance') as Appearance || 'dark')
  const [accent, setAccent] = useState<Accent>(() => typeof localStorage === 'undefined' ? 'blue' : localStorage.getItem('project-lens-accent') as Accent || 'blue')
  const [webResearchEnabled, setWebResearchEnabled] = useState(() => typeof localStorage === 'undefined' ? true : localStorage.getItem('project-lens-web-research') !== 'false')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    document.documentElement.dataset.accent = accent
    localStorage.setItem('project-lens-appearance', appearance); localStorage.setItem('project-lens-accent', accent); localStorage.setItem('project-lens-web-research', String(webResearchEnabled))
  }, [appearance, accent, webResearchEnabled])

  useEffect(() => { void loadRuntime() }, [])
  useEffect(() => {
    if (!authSession || authSession.status !== 'waiting-for-user') return
    const timer = window.setInterval(() => { void checkConnection(authSession.id) }, 3_000)
    return () => window.clearInterval(timer)
  }, [authSession])
  useEffect(() => {
    if (!runId) return
    const poll = async () => {
      const response = await fetch(`/api/analysis/${runId}`)
      if (!response.ok) { setRunStatus(undefined); setRunId(undefined); setError('The analysis session was interrupted because the local service restarted.'); setMode('failed'); return }
      const status = await response.json() as AnalysisRunStatusDto; setRunStatus(status)
    }
    void poll(); const timer = window.setInterval(() => { void poll() }, 3_000); return () => window.clearInterval(timer)
  }, [runId])
  async function loadRuntime() {
    try {
      const agents = await fetch('/api/agents').then(async (response) => response.ok ? response.json() as Promise<AgentStatusDto[]> : Promise.reject())
      const detected = agents[0]; setAgent(detected)
      if (!detected?.installed) { setRuntimeStatus(detected?.error ?? 'OpenCode is unavailable. Install and configure OpenCode, then restart Project Lens.'); return }
      setRuntimeStatus('Loading OpenCode models…')
      const discovered = await fetch('/api/agents/opencode/models').then(async (response) => response.ok ? response.json() as Promise<ModelDto[]> : Promise.reject(await response.json()))
      setModels(discovered)
      const discoveredProviders = await fetch('/api/opencode/providers').then(async (response) => response.ok ? response.json() as Promise<ProviderDto[]> : Promise.resolve([]))
      setProviders(discoveredProviders); setRuntimeStatus(discovered.length ? 'OpenCode detected' : 'No configured models. Configure a provider in OpenCode, then restart Project Lens.')
    } catch { setRuntimeStatus('Project Lens could not reach its local runtime. Run npm run dev and try again.') }
  }

  async function openPreparedSample() {
    setLocalProject(undefined); setProjectNotice(undefined)
    setMode('analysing'); setError(undefined); setAnalysisStage(undefined); setAnalysisStartedAt(Date.now()); setAnalysisEvents([{ type: 'queued', message: 'Preparing the sample project.' }])
    try {
      const project = await bundledSampleProjectSource.load()
      const analysis: ProjectAnalysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (stage, status) => { if (status === 'running') { setAnalysisStage(stage); setAnalysisEvents((current) => [...current, { type: 'analysing', message: analysisStages.find((item) => item.id === stage)?.label ?? stage }]) } }, 120)
      const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Sample')
      setKnowledge(validatePresentationKnowledgeBase(preparedSamplePresentationKnowledge, raw).length ? createPresentationFallback(raw) : preparedSamplePresentationKnowledge)
      setMode('workspace')
    } catch { setError('The prepared sample could not be analysed. Try again.'); setMode('launcher') }
  }

  async function analyseWithOpenCode(modelId: string) {
    setMode('analysing'); setError(undefined); setAnalysisStage(undefined); setLastModel(modelId); setAnalysisStartedAt(Date.now()); setAnalysisEvents([])
    try {
      const endpoint = localProject ? '/api/analysis/local' : '/api/analysis/sample'
      const body = localProject ? { projectId: localProject.id, name: localProject.name, files: localProject.files, modelId, webResearchEnabled } : { agentId: 'opencode', modelId, webResearchEnabled }
      const started = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (response) => response.ok ? response.json() as Promise<{ runId: string }> : Promise.reject(await response.json()))
      setRunId(started.runId); setRunStatus(undefined); setCancelling(false)
      const stream = new EventSource(`/api/analysis/${started.runId}/events`)
      for (const type of ['queued', 'preparing-evidence', 'starting-agent', 'analysing', 'validating', 'completed', 'failed', 'cancelled']) {
        stream.addEventListener(type, (message) => {
          const event = JSON.parse((message as MessageEvent).data) as AnalysisEventDto
          setAnalysisEvents((current) => [...current, event])
          const stageByEvent: Record<string, AnalysisStageId> = { 'preparing-evidence': 'inventory', 'starting-agent': 'relationships', analysing: 'features', validating: 'features' }
          if (stageByEvent[event.type]) setAnalysisStage(stageByEvent[event.type])
          if (event.type === 'completed' && event.result) { stream.close(); setKnowledge(event.result); setRunId(undefined); setRunStatus(undefined); setMode('workspace') }
          if (event.type === 'failed' || event.type === 'cancelled') { stream.close(); setRunId(undefined); setRunStatus(undefined); setCancelling(false); setError(event.error ?? (event.type === 'cancelled' ? 'Analysis was cancelled.' : 'Analysis failed.')); setMode('failed') }
        })
      }
      stream.onerror = () => { stream.close(); void fetch(`/api/analysis/${started.runId}`).then(async (response) => { if (!response.ok) { setRunId(undefined); setRunStatus(undefined); setError('The analysis session was interrupted because the local service restarted.'); setMode('failed') } else setRunStatus(await response.json() as AnalysisRunStatusDto) }).catch(() => { setRunId(undefined); setRunStatus(undefined); setError('The analysis connection ended unexpectedly.'); setMode('failed') }) }
    } catch (reason) { setRunId(undefined); setError(typeof reason === 'object' && reason && 'error' in reason ? String(reason.error) : 'Analysis could not start.'); setMode('failed') }
  }

  async function importLocalProject(name: string, files: ProjectFile[], summary: string, skipped: Record<LocalSkipReason, number>) {
    const project = await localFolderProjectSource(name, files).load()
    setLocalProject({ name: project.name, id: project.id, files: project.files, summary, skipped })
    setError(undefined); setAnalysisStage(undefined); setProjectNotice(summary); setMode('launcher')
  }

  async function cancelAnalysis() { if (!runId || cancelling) return; setCancelling(true); await fetch(`/api/analysis/${runId}/cancel`, { method: 'POST' }) }
  async function checkReadiness() { const response = await fetch('/api/opencode/readiness'); const result = await response.json() as { ready?: boolean; message?: string }; if (response.ok && result.ready) { setError(undefined); setRuntimeStatus('OpenCode readiness confirmed'); setMode('launcher') } else setError(result.message ?? 'OpenCode is still busy. Try again later.') }
  async function refreshProviders() { const response = await fetch('/api/opencode/providers'); if (response.ok) setProviders(await response.json()); await refreshModels() }
  async function refreshModels() { const response = await fetch('/api/opencode/models'); if (response.ok) setModels(await response.json()) }
  async function connectProvider(providerId: string) { const response = await fetch('/api/opencode/providers/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); const result = await response.json() as ProviderAuthSessionDto & { error?: string }; if (response.ok) setAuthSession(result); setRuntimeStatus(result.message ?? result.error ?? 'Authentication did not start.') }
  async function checkConnection(id = authSession?.id) { if (!id) return; const response = await fetch(`/api/opencode/auth-sessions/${id}`); const session = await response.json() as ProviderAuthSessionDto; if (!response.ok) { setRuntimeStatus('Project Lens could not verify the OpenCode connection.'); return }; setAuthSession(session); setRuntimeStatus(session.message); if (session.status === 'connected') { await refreshProviders(); await refreshModels() } }
  async function cancelConnection() { if (!authSession) return; const response = await fetch(`/api/opencode/auth-sessions/${authSession.id}`, { method: 'POST' }); if (response.ok) { const session = await response.json() as ProviderAuthSessionDto; setAuthSession(session); setRuntimeStatus(session.message) } }
  async function disconnectProvider(providerId: string) { await fetch('/api/opencode/providers/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); await refreshProviders(); await refreshModels() }
  function returnToLauncher() { setKnowledge(null); setProjectNotice(undefined); setMode('launcher') }
  if (mode === 'workspace' && knowledge) return <KnowledgeWorkspace knowledge={knowledge} projectNotice={projectNotice} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onReturn={returnToLauncher} onReanalyse={() => lastModel ? analyseWithOpenCode(lastModel) : openPreparedSample()} />
  if (mode === 'analysing' || mode === 'failed') return <AnalysisProgress projectName={localProject?.name ?? 'prepared sample'} modelId={lastModel} events={analysisEvents} startedAt={analysisStartedAt} runState={runStatus?.state} lastAnyEventAt={runStatus?.lastAnyEventAt} lastGenuineAgentEventAt={runStatus?.lastGenuineAgentEventAt} cancelling={cancelling} failed={mode === 'failed' ? error : undefined} onCancel={cancelAnalysis} onRetry={() => lastModel ? analyseWithOpenCode(lastModel) : openPreparedSample()} onChooseModel={() => setMode('launcher')} onConnectOpenCode={() => void connectProvider('opencode')} onCheckReadiness={() => void checkReadiness()} />
  return <Launcher agent={agent} models={models} providers={providers} authSession={authSession} runtimeStatus={runtimeStatus} isAnalysing={false} analysisStage={analysisStage} error={error} appearance={appearance} accent={accent} selectedProjectName={localProject?.name} selectedProjectSummary={localProject?.summary} selectedProjectSkipped={localProject?.skipped} webResearchEnabled={webResearchEnabled} onAppearance={setAppearance} onAccent={setAccent} onWebResearchEnabled={setWebResearchEnabled} onTrySample={analyseWithOpenCode} onUsePrepared={openPreparedSample} onImportLocal={importLocalProject} onCancel={cancelAnalysis} onRefreshProviders={refreshProviders} onRefreshModels={refreshModels} onConnectProvider={connectProvider} onDisconnectProvider={disconnectProvider} onCheckConnection={checkConnection} onCancelConnection={cancelConnection} />
}
