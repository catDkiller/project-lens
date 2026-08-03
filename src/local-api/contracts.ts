import type { PresentationKnowledgeBase } from '../knowledge'

export interface CodexStatusDto {
  status: 'checking' | 'ready' | 'sign-in-required' | 'unavailable'
  version?: string
  error?: string
  models?: string[]
}

export interface RuntimeMetaDto {
  app: 'project-lens'
  buildId: string
  gitCommit: string
  daemonStartedAt: string
  processId: number
  apiVersion: number
  persistedRunSchemaVersion: number
  reportSchemaVersion: number
  artifactValidatorVersion: number
}

export type AnalysisEventType = 'queued' | 'preparing-evidence' | 'workspace-ready' | 'enriching' | 'enriched' | 'enrichment-unavailable' | 'run_started' | 'thread_started' | 'status' | 'tool_call' | 'tool_result' | 'file_write' | 'warning' | 'artifact_ready' | 'completed' | 'failed' | 'cancelled'
export type RunStageId = 'preparing' | 'discovery' | 'filtering' | 'snapshot' | 'codex-preparation' | 'codex-analysis' | 'validation' | 'opening-report'
export type RunStageStatus = 'pending' | 'active' | 'complete' | 'warning' | 'failed' | 'cancelled'
export type AnalysisRunState = 'queued' | 'preparing-project' | 'workspace-ready' | 'enriching-with-codex' | 'enrichment-complete' | 'enrichment-unavailable' | 'running' | 'artifact-ready' | 'completed' | 'cancelling' | 'cancelled' | 'failed'
export type AnalysisFailureCode = 'codex-unavailable' | 'codex-sign-in-required' | 'codex-invocation-failed' | 'process-startup-failure' | 'output-invalid' | 'analysis-aborted' | 'unknown'

export interface AnalysisEventDto {
  id?: string
  runId?: string
  sequence?: number
  type: AnalysisEventType
  stage?: RunStageId
  status?: RunStageStatus
  message?: string
  timestamp?: string
  progress?: { current: number; total: number; unit: 'files' | 'bytes' | 'checks' | 'artifacts'; percentage?: number }
  file?: { projectRelativePath: string; action: 'discovered' | 'selected' | 'copied' | 'inspected' | 'written' }
  process?: { alive: boolean; pidAvailable: boolean; exitCode?: number | null }
  metadata?: { discoveredFiles?: number; includedFiles?: number; excludedFiles?: number; processedBytes?: number; selectedModel?: string; artifactName?: string }
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
