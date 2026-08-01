import type { PresentationKnowledgeBase } from '../knowledge'

export interface CodexStatusDto {
  status: 'checking' | 'ready' | 'sign-in-required' | 'unavailable'
  version?: string
  error?: string
}

export type AnalysisEventType = 'queued' | 'preparing-evidence' | 'starting-agent' | 'analysing' | 'validating' | 'repairing' | 'completed' | 'failed' | 'cancelled'
export type AnalysisRunState = 'queued' | 'preparing-project' | 'spawning-agent' | 'agent-process-running' | 'receiving-agent-events' | 'validating' | 'repairing' | 'completed' | 'cancelling' | 'cancelled' | 'failed'
export type AnalysisFailureCode = 'codex-unavailable' | 'codex-sign-in-required' | 'codex-invocation-failed' | 'process-startup-failure' | 'output-invalid' | 'analysis-aborted' | 'unknown'

export interface AnalysisEventDto {
  type: AnalysisEventType
  message?: string
  timestamp?: string
  diagnostic?: { code?: AnalysisFailureCode; exitCode?: number | null; stderr?: string; codexVersion?: string; lastActivity?: string }
  result?: PresentationKnowledgeBase
  error?: string
}

export interface AnalysisRunStatusDto {
  runId: string
  projectId: string
  agentId: 'codex'
  model?: string
  codexVersion?: string
  state: AnalysisRunState
  createdAt: string
  startedAt?: string
  childPid?: number
  lastAnyEventAt?: string
  lastGenuineAgentEventAt?: string
  cancellationRequested: boolean
  terminalOutcome?: 'completed' | 'cancelled' | 'failed'
  events: AnalysisEventDto[]
}

export interface AnalysisStartDto { runId: string }
