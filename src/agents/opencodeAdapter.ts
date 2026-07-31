import {
  applyProviderAvailability,
  detectOpenCode,
  discoverModels,
  discoverProviders,
} from '../local-api/opencode'
import type { AgentAdapter, AgentCapabilities, AgentModel, AgentProvider, AgentSnapshot, AgentAuthenticationStatus } from './types'

const openCodeCapabilities: AgentCapabilities = {
  projectRead: true,
  projectSearch: true,
  webSearch: true,
  webFetch: true,
  streaming: true,
  structuredOutput: true,
  modelDiscovery: true,
  authenticationDetection: true,
  cancellation: true,
  readOnlyEnforcement: true,
}

function readinessFromModel(modelReadiness?: 'available' | 'ready' | 'requires-provider' | 'unavailable' | 'unknown'): AgentSnapshot['readiness'] {
  if (modelReadiness === 'ready') return 'ready'
  if (modelReadiness === 'requires-provider') return 'needs-authentication'
  if (modelReadiness === 'unavailable') return 'unhealthy'
  return 'installed'
}

function mapModelReadiness(value: 'available' | 'ready' | 'requires-provider' | 'unavailable' | 'unknown'): AgentModel['readiness'] {
  if (value === 'ready') return 'ready'
  if (value === 'requires-provider') return 'requires-provider'
  if (value === 'unavailable') return 'temporarily-unavailable'
  return 'unknown'
}

function mapProvider(provider: { id: string; displayName: string; connected: boolean; connectionMethod?: string }): AgentProvider {
  return {
    id: provider.id,
    displayName: provider.displayName,
    readiness: provider.connected ? 'ready' : 'setup-required',
    connectionMethod: provider.connectionMethod,
  }
}

export function createOpenCodeAgent(): AgentAdapter {
  return {
    id: 'opencode',
    displayName: 'OpenCode',
    installed: false,
    readiness: 'unavailable',
    authenticationStatus: 'disconnected',
    capabilities: openCodeCapabilities,
    models: async () => {
      const detected = await detectOpenCode()
      if (!detected.installed || !detected.executablePath) return []
      const providers = await discoverProviders(detected.executablePath)
      return applyProviderAvailability(await discoverModels(detected.executablePath), providers).map((model) => ({
        providerId: model.providerId,
        modelId: model.modelId,
        fullId: model.fullId,
        displayName: model.displayName,
        readiness: mapModelReadiness(model.availability),
        availabilityReason: model.availabilityReason,
        free: model.free,
        local: model.local,
      }))
    },
    providers: async () => {
      const detected = await detectOpenCode()
      if (!detected.installed || !detected.executablePath) return []
      return (await discoverProviders(detected.executablePath)).map(mapProvider)
    },
    healthCheck: async () => {
      const detected = await detectOpenCode()
      const providers = detected.installed && detected.executablePath ? await discoverProviders(detected.executablePath) : []
      const models = detected.installed && detected.executablePath ? applyProviderAvailability(await discoverModels(detected.executablePath), providers) : []
      const firstReady = models.find((model) => model.availability === 'ready' || model.availability === 'requires-provider')
      const mappedProviders = providers.map(mapProvider)
      const snapshot: AgentSnapshot = {
        id: detected.id,
        displayName: detected.displayName,
        installed: detected.installed,
        version: detected.version,
        readiness: readinessFromModel(firstReady?.availability),
        authenticationStatus: (providers.some((provider) => provider.connected) ? 'connected' : 'disconnected') as AgentAuthenticationStatus,
        authenticationMethod: providers.find((provider) => provider.connected)?.connectionMethod,
        capabilities: openCodeCapabilities,
        models: models.map((model) => ({
          providerId: model.providerId,
          modelId: model.modelId,
          fullId: model.fullId,
          displayName: model.displayName,
          readiness: mapModelReadiness(model.availability),
          availabilityReason: model.availabilityReason,
          free: model.free,
          local: model.local,
        })),
        providers: mappedProviders,
        diagnostics: {
          message: providers.length ? undefined : 'No providers were discovered.',
        },
      }
      return snapshot
    },
    diagnostics: async () => {
      const detected = await detectOpenCode()
      return {
        message: detected.error,
        stderr: detected.error,
      }
    },
  }
}
