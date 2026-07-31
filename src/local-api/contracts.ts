import type { PresentationKnowledgeBase } from '../knowledge'

export interface AgentStatusDto { id: 'opencode'; displayName: 'OpenCode'; installed: boolean; executablePath?: string; version?: string; status: 'available' | 'unavailable'; error?: string }
export interface ProviderDto { id: string; displayName: string; connected: boolean; connectionMethod?: string }
export type ModelAvailability = 'available' | 'ready' | 'requires-provider' | 'unavailable' | 'unknown'
export interface ModelDto { providerId: string; modelId: string; fullId: string; displayName: string; availability: ModelAvailability; free?: boolean; connected?: boolean; runnable?: boolean; availabilityReason?: string; local?: boolean; variant?: string }
export type AnalysisEventType = 'queued' | 'preparing-evidence' | 'starting-agent' | 'analysing' | 'validating' | 'completed' | 'failed' | 'cancelled'
export interface AnalysisEventDto { type: AnalysisEventType; message?: string; timestamp?: string; path?: string; diagnostic?: { timeoutType?: string; exitCode?: number | null; stderr?: string }; result?: PresentationKnowledgeBase; error?: string }
export interface AnalysisStartDto { runId: string }
