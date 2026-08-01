import { createCodexRuntime } from './codexAdapter'
import type { AgentRuntime } from './types'
import { detectOpenCode } from '../local-api/opencode'

export async function detectAgentRuntimes(): Promise<AgentRuntime[]> {
  const codex = await createCodexRuntime().detect()
  const openCode = await detectOpenCode()
  const openCodeRuntime: AgentRuntime = {
    id: 'opencode', displayName: 'OpenCode', executable: openCode.executablePath, version: openCode.version,
    installationStatus: openCode.installed ? 'installed' : 'not-installed', authenticationStatus: openCode.authenticationStatus ?? 'disconnected',
    readiness: openCode.installed ? (openCode.readiness === 'ready' ? 'ready' : openCode.readiness === 'needs-authentication' ? 'sign-in-required' : 'installed-but-unavailable') : 'not-installed',
    capabilities: { projectRead: true, projectSearch: true, webSearch: true, webFetch: true, streaming: true, structuredOutput: true, modelDiscovery: true, authenticationDetection: true, cancellation: true, readOnlyEnforcement: true },
    defaultModelLabel: 'OpenCode configured model', detect: async () => openCodeRuntime, checkAuthentication: async () => openCodeRuntime.authenticationStatus,
    checkReadiness: async () => openCodeRuntime.readiness, runAnalysis: async () => { throw new Error('Use the existing OpenCode coordinator.') }, cancel: async () => {}, normalizeEvents: () => undefined,
  }
  return [codex, openCodeRuntime]
}

