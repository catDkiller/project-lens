export interface LauncherAgentOption { id: string; name: string; models: string[] }

// Demo-only values for the prepared sample. They are not local agent detection.
export const preparedSampleAgents: LauncherAgentOption[] = [{ id: 'codex-demo', name: 'Codex (sample configuration)', models: ['Prepared sample'] }]
