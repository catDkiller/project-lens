export type AgentReadiness = 'unavailable' | 'installed' | 'needs-authentication' | 'ready' | 'unhealthy'
export type AgentAuthenticationStatus = 'disconnected' | 'launching' | 'waiting-for-user' | 'connected' | 'cancelled' | 'launch-failed' | 'verification-failed'
export type ModelReadiness = 'catalogue-only' | 'requires-provider' | 'ready' | 'temporarily-unavailable' | 'removed' | 'unknown'

export interface AgentCapabilities {
  projectRead: boolean
  projectSearch: boolean
  webSearch: boolean
  webFetch: boolean
  streaming: boolean
  structuredOutput: boolean
  modelDiscovery: boolean
  authenticationDetection: boolean
  cancellation: boolean
  readOnlyEnforcement: boolean
}

export interface AgentModel {
  providerId: string
  modelId: string
  fullId: string
  displayName: string
  readiness: ModelReadiness
  availabilityReason?: string
  free?: boolean
  local?: boolean
}

export interface AgentProvider {
  id: string
  displayName: string
  readiness: 'ready' | 'setup-required' | 'unavailable'
  connectionMethod?: string
}

export interface AgentDiagnostics {
  code?: string
  timeoutType?: string
  exitCode?: number | null
  stderr?: string
  lastActivity?: string
  message?: string
}

export interface AgentSnapshot {
  id: string
  displayName: string
  installed: boolean
  version?: string
  readiness: AgentReadiness
  authenticationStatus: AgentAuthenticationStatus
  authenticationMethod?: string
  capabilities: AgentCapabilities
  models: AgentModel[]
  providers: AgentProvider[]
  diagnostics?: AgentDiagnostics
}

export interface AgentAdapter {
  id: string
  displayName: string
  installed: boolean
  version?: string
  readiness: AgentReadiness
  authenticationStatus: AgentAuthenticationStatus
  authenticationMethod?: string
  capabilities: AgentCapabilities
  models: () => Promise<AgentModel[]>
  providers: () => Promise<AgentProvider[]>
  healthCheck: () => Promise<AgentSnapshot>
  diagnostics: () => Promise<AgentDiagnostics>
}
