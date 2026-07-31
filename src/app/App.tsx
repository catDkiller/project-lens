import { useEffect, useState } from 'react'
import { runProjectAnalysis } from '../analysis'
import type { AnalysisStageId, ProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { createProjectKnowledgeBase, createPresentationFallback, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import { preparedSamplePresentationKnowledge } from '../fixtures/preparedSamplePresentationKnowledge'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import { localFolderProjectSource } from '../project-sources/LocalFolderProjectSource'
import type { ProjectFile } from '../project-sources/types'
import type { AgentStatusDto, AnalysisEventDto, ModelDto, ProviderDto } from '../local-api/contracts'
import { Launcher } from './Launcher'
import { KnowledgeWorkspace } from './KnowledgeWorkspace'
import type { Accent, Appearance } from './ThemeMenu'
import './app.css'

type AppMode = 'launcher' | 'analysing' | 'workspace'

export function App() {
  const [mode, setMode] = useState<AppMode>('launcher')
  const [knowledge, setKnowledge] = useState<PresentationKnowledgeBase | null>(null)
  const [error, setError] = useState<string>()
  const [analysisStage, setAnalysisStage] = useState<AnalysisStageId>()
  const [agent, setAgent] = useState<AgentStatusDto>()
  const [models, setModels] = useState<ModelDto[]>([])
  const [providers, setProviders] = useState<ProviderDto[]>([])
  const [runtimeStatus, setRuntimeStatus] = useState('Checking local runtime…')
  const [runId, setRunId] = useState<string>()
  const [lastModel, setLastModel] = useState<string>()
  const [projectNotice, setProjectNotice] = useState<string>()
  const [localProject, setLocalProject] = useState<{ name: string; id: string; files: ProjectFile[]; summary: string }>()
  const [appearance, setAppearance] = useState<Appearance>(() => typeof localStorage === 'undefined' ? 'dark' : localStorage.getItem('project-lens-appearance') as Appearance || 'dark')
  const [accent, setAccent] = useState<Accent>(() => typeof localStorage === 'undefined' ? 'blue' : localStorage.getItem('project-lens-accent') as Accent || 'blue')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    document.documentElement.dataset.accent = accent
    localStorage.setItem('project-lens-appearance', appearance); localStorage.setItem('project-lens-accent', accent)
  }, [appearance, accent])

  useEffect(() => { void loadRuntime() }, [])
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
    setMode('analysing'); setError(undefined); setAnalysisStage(undefined)
    try {
      const project = await bundledSampleProjectSource.load()
      const analysis: ProjectAnalysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, (stage, status) => { if (status === 'running') setAnalysisStage(stage) }, 120)
      const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Sample')
      setKnowledge(validatePresentationKnowledgeBase(preparedSamplePresentationKnowledge, raw).length ? createPresentationFallback(raw) : preparedSamplePresentationKnowledge)
      setMode('workspace')
    } catch { setError('The prepared sample could not be analysed. Try again.'); setMode('launcher') }
  }

  async function analyseWithOpenCode(modelId: string) {
    setMode('analysing'); setError(undefined); setAnalysisStage(undefined); setLastModel(modelId)
    try {
      const endpoint = localProject ? '/api/analysis/local' : '/api/analysis/sample'
      const body = localProject ? { projectId: localProject.id, name: localProject.name, files: localProject.files, modelId } : { agentId: 'opencode', modelId }
      const started = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (response) => response.ok ? response.json() as Promise<{ runId: string }> : Promise.reject(await response.json()))
      setRunId(started.runId)
      const stream = new EventSource(`/api/analysis/${started.runId}/events`)
      for (const type of ['queued', 'preparing-evidence', 'starting-agent', 'analysing', 'validating', 'completed', 'failed', 'cancelled']) {
        stream.addEventListener(type, (message) => {
          const event = JSON.parse((message as MessageEvent).data) as AnalysisEventDto
          const stageByEvent: Record<string, AnalysisStageId> = { 'preparing-evidence': 'inventory', 'starting-agent': 'relationships', analysing: 'features', validating: 'features' }
          if (stageByEvent[event.type]) setAnalysisStage(stageByEvent[event.type])
          if (event.type === 'completed' && event.result) { stream.close(); setKnowledge(event.result); setRunId(undefined); setMode('workspace') }
          if (event.type === 'failed' || event.type === 'cancelled') { stream.close(); setRunId(undefined); setError(event.error ?? (event.type === 'cancelled' ? 'Analysis was cancelled.' : 'Analysis failed.')); setMode('launcher') }
        })
      }
      stream.onerror = () => { stream.close(); setRunId(undefined); setError('The analysis connection ended unexpectedly. Try again.'); setMode('launcher') }
    } catch (reason) { setRunId(undefined); setError(typeof reason === 'object' && reason && 'error' in reason ? String(reason.error) : 'Analysis could not start.'); setMode('launcher') }
  }

  async function importLocalProject(name: string, files: ProjectFile[]) {
    const project = await localFolderProjectSource(name, files).load()
    setLocalProject({ name: project.name, id: project.id, files: project.files, summary: `${project.files.length} files included.` })
    setError(undefined); setAnalysisStage(undefined); setProjectNotice(`${project.files.length} files included.`); setMode('launcher')
  }

  async function cancelAnalysis() { if (runId) await fetch(`/api/analysis/${runId}/cancel`, { method: 'POST' }) }
  async function refreshProviders() { const response = await fetch('/api/opencode/providers'); if (response.ok) setProviders(await response.json()); await refreshModels() }
  async function refreshModels() { const response = await fetch('/api/opencode/models'); if (response.ok) setModels(await response.json()) }
  async function connectProvider(providerId: string) { const response = await fetch('/api/opencode/providers/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); const result = await response.json(); setRuntimeStatus(result.message ?? result.error ?? 'Authentication did not start.'); if (response.ok) { for (let attempt = 0; attempt < 6; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 1500)); await refreshProviders() } } }
  async function disconnectProvider(providerId: string) { await fetch('/api/opencode/providers/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); await refreshProviders(); await refreshModels() }
  function returnToLauncher() { setKnowledge(null); setProjectNotice(undefined); setMode('launcher') }
  if (mode === 'workspace' && knowledge) return <KnowledgeWorkspace knowledge={knowledge} projectNotice={projectNotice} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onReturn={returnToLauncher} onReanalyse={() => lastModel ? analyseWithOpenCode(lastModel) : openPreparedSample()} />
  return <Launcher agent={agent} models={models} providers={providers} runtimeStatus={runtimeStatus} isAnalysing={mode === 'analysing'} analysisStage={analysisStage} error={error} appearance={appearance} accent={accent} selectedProjectName={localProject?.name} selectedProjectSummary={localProject?.summary} onAppearance={setAppearance} onAccent={setAccent} onTrySample={analyseWithOpenCode} onUsePrepared={openPreparedSample} onImportLocal={importLocalProject} onCancel={cancelAnalysis} onRefreshProviders={refreshProviders} onRefreshModels={refreshModels} onConnectProvider={connectProvider} onDisconnectProvider={disconnectProvider} />
}
