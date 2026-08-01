import type { AgentStatusDto, ModelDto } from '../local-api/contracts'

export type LauncherSource =
  | { kind: 'prepared'; name?: string; summary?: string }
  | { kind: 'local'; name: string; summary?: string; support: 'supported' | 'unsupported' | 'too-large' | 'failed'; diagnostics?: string[] }
  | undefined

export type LauncherSourceStatus = 'empty' | 'reading' | 'prepared' | 'local-supported' | 'local-unsupported' | 'local-too-large' | 'local-failed'
export type LauncherEngineStatus = 'checking' | 'ready' | 'needs-action' | 'unavailable'
export type LauncherRunStatus = 'idle' | 'starting' | 'running' | 'cancelling' | 'failed' | 'completed'
export type LauncherView = 'EMPTY' | 'READING_SOURCE' | 'UNSUPPORTED_SOURCE' | 'SOURCE_FAILED' | 'SOURCE_TOO_LARGE' | 'ENGINE_CHECKING' | 'ENGINE_NEEDS_ACTION' | 'READY' | 'STARTING' | 'RUNNING' | 'FAILED_RETURN'

export interface LauncherEngineState {
  status: LauncherEngineStatus
  displayName?: string
  recovery?: string
}

export interface LauncherRunState {
  status: LauncherRunStatus
  error?: string
}

export interface CanonicalLauncherFacts {
  source: { status: LauncherSourceStatus; name?: string; summary?: string; diagnostics?: string[] }
  engine: LauncherEngineState
  run: LauncherRunState
  runtimeSafetyReady?: boolean
}

export interface CanonicalLauncherState extends CanonicalLauncherFacts {
  view: LauncherView
  canAnalyse: boolean
  disabledReason?: string
  privacyDescription: string
}

export const privacyDescription = 'Files are prepared locally. Relevant project text may be sent through the active AI engine. Sensitive and ignored files are excluded.'

export function deriveCanonicalLauncherState(facts: CanonicalLauncherFacts): CanonicalLauncherState {
  const { source, engine, run } = facts
  let view: LauncherView
  if (run.status === 'starting') view = 'STARTING'
  else if (run.status === 'running' || run.status === 'cancelling') view = 'RUNNING'
  else if (source.status === 'reading') view = 'READING_SOURCE'
  else if (source.status === 'local-failed') view = 'SOURCE_FAILED'
  else if (source.status === 'local-too-large') view = 'SOURCE_TOO_LARGE'
  else if (source.status === 'local-unsupported') view = 'UNSUPPORTED_SOURCE'
  else if (source.status === 'empty') view = 'EMPTY'
  else if (run.status === 'failed') view = 'FAILED_RETURN'
  else if (engine.status === 'checking') view = 'ENGINE_CHECKING'
  else if (engine.status === 'needs-action' || engine.status === 'unavailable') view = 'ENGINE_NEEDS_ACTION'
  else view = 'READY'

  const reasons: Partial<Record<LauncherView, string>> = {
    EMPTY: 'Choose a project or use the prepared sample.',
    READING_SOURCE: 'Reading the selected project.',
    UNSUPPORTED_SOURCE: 'This project is not a supported React/Vite project.',
    SOURCE_FAILED: 'The project could not be prepared. Try choosing it again.',
    SOURCE_TOO_LARGE: 'This project is too large to prepare safely.',
    ENGINE_CHECKING: 'Checking the active AI engine.',
    ENGINE_NEEDS_ACTION: engine.recovery ?? 'The AI engine needs attention.',
    STARTING: 'Starting analysis.',
    RUNNING: 'Analysis is running.',
    FAILED_RETURN: run.error ?? 'Analysis failed. You can try again.',
  }
  const canAnalyse = view === 'READY' && source.status !== 'empty' && engine.status === 'ready' && facts.runtimeSafetyReady !== false
  const disabledReason = canAnalyse ? undefined : (view === 'READY' && facts.runtimeSafetyReady === false ? 'Runtime safety is unavailable.' : reasons[view])
  return { ...facts, view, canAnalyse, disabledReason, privacyDescription }
}

export function deriveEngineState(agents: AgentStatusDto[], models: ModelDto[], storedRuntime?: string, storedModel?: string): LauncherEngineState & { activeRuntime?: AgentStatusDto; execution?: ModelDto } {
  if (!agents.length) return { status: 'checking' }
  const activeRuntime = agents.find((agent) => agent.id === storedRuntime && agent.readiness === 'ready') ?? agents.find((agent) => agent.readiness === 'ready')
  if (!activeRuntime) return { status: 'needs-action', recovery: agents.some((agent) => agent.installed) ? 'Connect or repair the active AI engine.' : 'Install and configure an AI engine.', displayName: agents[0]?.displayName }
  const readyModel = (model: ModelDto) => model.availability === 'ready' && model.runnable === true && (model.readiness === undefined || model.readiness === 'ready')
  const execution = activeRuntime.id === 'opencode' ? models.find((model) => model.fullId === storedModel && readyModel(model)) ?? models.find(readyModel) : undefined
  if (activeRuntime.id !== 'opencode' || !execution) return { status: 'needs-action', displayName: activeRuntime.displayName, activeRuntime, recovery: 'Choose a ready model in the AI engine.' }
  return { status: 'ready', displayName: activeRuntime.displayName, activeRuntime, execution }
}

/** Backwards-compatible adapter for the existing analysis submission code. */
export function deriveLauncherState(agents: AgentStatusDto[], models: ModelDto[], source: LauncherSource, storedRuntime?: string, storedModel?: string, run: LauncherRunState = { status: 'idle' }, sourceReading = false) {
  const engine = deriveEngineState(agents, models, storedRuntime, storedModel)
  const sourceState = !source ? { status: sourceReading ? 'reading' as const : 'empty' as const } : sourceReading ? { status: 'reading' as const, name: source.kind === 'local' ? source.name : source.name, summary: source.summary } : source.kind === 'prepared' ? { status: 'prepared' as const, name: source.name, summary: source.summary } : { status: source.support === 'supported' ? 'local-supported' as const : source.support === 'unsupported' ? 'local-unsupported' as const : source.support === 'too-large' ? 'local-too-large' as const : 'local-failed' as const, name: source.name, summary: source.summary, diagnostics: source.diagnostics }
  const state = deriveCanonicalLauncherState({ source: sourceState, engine, run, runtimeSafetyReady: true })
  return { ...state, disabledReason: state.canAnalyse ? undefined : (!source ? 'Choose a project or use the prepared sample.' : (!engine.activeRuntime || !engine.execution ? 'AI setup is required.' : state.disabledReason)), activeRuntime: engine.activeRuntime, execution: engine.execution, source }
}
