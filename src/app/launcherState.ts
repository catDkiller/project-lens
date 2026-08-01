import type { AgentStatusDto, ModelDto } from '../local-api/contracts'

export type LauncherSource = { kind: 'prepared' } | { kind: 'local'; name: string; summary: string } | undefined

function ready(model: ModelDto) { return model.availability === 'ready' && model.runnable === true }

export function deriveLauncherState(agents: AgentStatusDto[], models: ModelDto[], source: LauncherSource, storedRuntime?: string, storedModel?: string) {
  const activeRuntime = agents.find((agent) => agent.id === storedRuntime && agent.readiness === 'ready') ?? agents.find((agent) => agent.readiness === 'ready')
  const execution = activeRuntime?.id === 'opencode' ? models.find((model) => model.fullId === storedModel && ready(model)) ?? models.find(ready) : undefined
  const disabledReason = !source ? 'Choose a project or use the prepared sample.' : !activeRuntime ? 'AI setup is required.' : !execution ? 'AI setup is required.' : undefined
  if (activeRuntime?.id !== 'opencode' && execution) throw new Error('A model cannot be attached to a non-OpenCode runtime.')
  return { source, activeRuntime, execution, canAnalyse: !disabledReason, disabledReason, privacyDescription: 'Files are prepared locally. Relevant project text may be sent through your active AI engine. Sensitive and ignored files are excluded.' }
}

