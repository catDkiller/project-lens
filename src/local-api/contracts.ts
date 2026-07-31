import type { PresentationKnowledgeBase } from '../knowledge'

export interface AgentStatusDto { id: 'opencode'; displayName: 'OpenCode'; installed: boolean; executablePath?: string; version?: string; status: 'available' | 'unavailable'; error?: string }
export interface ModelDto { providerId: string; modelId: string; fullId: string; displayName: string; availability: 'available'; variant?: string }
export type AnalysisEventType = 'queued' | 'preparing-evidence' | 'starting-agent' | 'analysing' | 'validating' | 'completed' | 'failed' | 'cancelled'
export interface AnalysisEventDto { type: AnalysisEventType; message?: string; result?: PresentationKnowledgeBase; error?: string }
export interface AnalysisStartDto { runId: string }
