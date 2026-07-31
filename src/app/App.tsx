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
      const started = await fetch('/api/analysis/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId: 'opencode', modelId }) }).then(async (response) => response.ok ? response.json() as Promise<{ runId: string }> : Promise.reject(await response.json()))
      setRunId(started.runId)
      const stream = new EventSource(`/api/analysis/${started.runId}/events`)
      for (const type of ['queued', 'preparing-evidence', 'starting-agent', 'analysing', 'validating', 'completed', 'failed', 'cancelled']) {
        stream.addEventListener(type, (message) => {
          const event = JSON.parse((message as MessageEvent).data) as AnalysisEventDto
          if (event.type === 'completed' && event.result) { stream.close(); setKnowledge(event.result); setRunId(undefined); setMode('workspace') }
          if (event.type === 'failed' || event.type === 'cancelled') { stream.close(); setRunId(undefined); setError(event.error ?? (event.type === 'cancelled' ? 'Analysis was cancelled.' : 'Analysis failed.')); setMode('launcher') }
        })
      }
      stream.onerror = () => { stream.close(); setRunId(undefined); setError('The analysis connection ended unexpectedly. Try again.'); setMode('launcher') }
    } catch (reason) { setRunId(undefined); setError(typeof reason === 'object' && reason && 'error' in reason ? String(reason.error) : 'Analysis could not start.'); setMode('launcher') }
  }

  async function importLocalProject(name: string, files: ProjectFile[]) {
    setMode('analysing'); setError(undefined); setAnalysisStage(undefined); setProjectNotice(undefined)
    try {
      const project = await localFolderProjectSource(name, files).load()
      const result = await fetch('/api/projects/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: project.name, files: project.files }) }).then(async (response) => response.ok ? response.json() as Promise<{ knowledge: PresentationKnowledgeBase; included: number; skipped: number; size: number }> : Promise.reject(await response.json()))
      setKnowledge(result.knowledge)
      setProjectNotice(`${project.name}: ${result.included} files included, ${result.skipped} skipped, ${(result.size / 1024).toFixed(1)} KB prepared locally.`)
      setMode('workspace')
    } catch (reason) { setError(typeof reason === 'object' && reason && 'error' in reason ? String(reason.error) : 'The local project could not be analysed.'); setMode('launcher') }
  }

  async function cancelAnalysis() { if (runId) await fetch(`/api/analysis/${runId}/cancel`, { method: 'POST' }) }
  async function refreshProviders() { const response = await fetch('/api/opencode/providers'); if (response.ok) setProviders(await response.json()) }
  async function refreshModels() { const response = await fetch('/api/opencode/models'); if (response.ok) setModels(await response.json()) }
  async function connectProvider(providerId: string) { const response = await fetch('/api/opencode/providers/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); const result = await response.json(); setRuntimeStatus(result.message ?? result.error ?? 'Authentication did not start.') }
  async function disconnectProvider(providerId: string) { await fetch('/api/opencode/providers/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId }) }); await refreshProviders(); await refreshModels() }
  function returnToLauncher() { setKnowledge(null); setProjectNotice(undefined); setMode('launcher') }
  if (mode === 'workspace' && knowledge) return <KnowledgeWorkspace knowledge={knowledge} projectNotice={projectNotice} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onReturn={returnToLauncher} onReanalyse={() => lastModel ? analyseWithOpenCode(lastModel) : openPreparedSample()} />
  return <Launcher agent={agent} models={models} providers={providers} runtimeStatus={runtimeStatus} isAnalysing={mode === 'analysing'} analysisStage={analysisStage} error={error} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onTrySample={analyseWithOpenCode} onUsePrepared={openPreparedSample} onImportLocal={importLocalProject} onCancel={cancelAnalysis} onRefreshProviders={refreshProviders} onRefreshModels={refreshModels} onConnectProvider={connectProvider} onDisconnectProvider={disconnectProvider} />
}
