import { Codex, type ThreadItem, type Usage } from '@openai/codex-sdk'
import { sanitizedCodexEnvironment } from './codex'

export interface CodexSdkRunOptions {
  executable: string
  workingDirectory: string
  prompt: string
  model?: string
  outputSchema?: unknown
  signal?: AbortSignal
}

export interface CodexSdkRunResult {
  threadId: string | null
  finalResponse: string
  items: ThreadItem[]
  usage: Usage | null
  terminalStatus: 'completed'
}

export async function runCodexSdk(options: CodexSdkRunOptions): Promise<CodexSdkRunResult> {
  const codex = new Codex({ codexPathOverride: options.executable, env: sanitizedCodexEnvironment() })
  const thread = codex.startThread({ workingDirectory: options.workingDirectory, skipGitRepoCheck: true, sandboxMode: 'read-only', approvalPolicy: 'never', networkAccessEnabled: false, webSearchMode: 'disabled', model: options.model })
  const result = await thread.run(options.prompt, { signal: options.signal, ...(options.outputSchema ? { outputSchema: options.outputSchema } : {}) })
  return { threadId: thread.id, finalResponse: result.finalResponse, items: result.items, usage: result.usage, terminalStatus: 'completed' }
}
