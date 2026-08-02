import type { CodexStatusDto } from '../local-api/contracts'

export type ModelChoice = 'gpt-5.4-mini' | 'gpt-5.4' | 'automatic'
export type LauncherSource = { kind: 'prepared'; projectType?: string } | { kind: 'local'; name: string; summary?: string; projectType?: string; support: 'supported' | 'too-large' | 'failed'; diagnostics?: string[] } | undefined
export interface CanonicalLauncherState { source: LauncherSource; engine: { status: 'checking' | 'ready' | 'needs-action' | 'unavailable'; displayName: string; recovery?: string }; model: ModelChoice; canAnalyse: boolean; disabledReason?: string; view: 'EMPTY' | 'READING_SOURCE' | 'READY' | 'SOURCE_FAILED' | 'SOURCE_TOO_LARGE' | 'ENGINE_CHECKING' | 'ENGINE_NEEDS_ACTION'; privacyDescription: string }
export const privacyDescription = 'Files are prepared locally. Relevant project text may be sent to Codex using your existing ChatGPT sign-in. Sensitive and ignored files are excluded.'
export function deriveLauncherState(codex: CodexStatusDto | undefined, source: LauncherSource, model: ModelChoice, reading = false): CanonicalLauncherState {
  const engine = !codex || codex.status === 'checking' ? { status: 'checking' as const, displayName: 'Codex' } : codex.status === 'ready' ? { status: 'ready' as const, displayName: 'Codex' } : { status: codex.status === 'unavailable' ? 'unavailable' as const : 'needs-action' as const, displayName: 'Codex', recovery: codex.status === 'sign-in-required' ? 'Sign in to Codex to analyse a project.' : codex.error ?? 'Codex is unavailable.' }
  const sourceProblem = source?.kind === 'local' && source.support !== 'supported' ? source.support : undefined
  const view = reading ? 'READING_SOURCE' : !source ? 'EMPTY' : sourceProblem === 'failed' ? 'SOURCE_FAILED' : sourceProblem === 'too-large' ? 'SOURCE_TOO_LARGE' : 'READY'
  const disabledReason = view === 'READY' ? undefined : view === 'EMPTY' ? 'Choose a project or use the prepared sample.' : view === 'READING_SOURCE' ? 'Reading the selected project.' : 'This project cannot be analysed yet.'
  return { source, engine, model, view, canAnalyse: view === 'READY', disabledReason, privacyDescription }
}
