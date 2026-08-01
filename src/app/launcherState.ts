import type { CodexStatusDto } from '../local-api/contracts'

export type LauncherSource = { kind: 'prepared' } | { kind: 'local'; name: string; summary?: string; support: 'supported' | 'unsupported' | 'too-large' | 'failed'; diagnostics?: string[] } | undefined
export interface CanonicalLauncherState { source: LauncherSource; engine: { status: 'checking' | 'ready' | 'needs-action' | 'unavailable'; displayName: string; recovery?: string }; canAnalyse: boolean; disabledReason?: string; view: 'EMPTY' | 'READING_SOURCE' | 'READY' | 'SOURCE_FAILED' | 'SOURCE_TOO_LARGE' | 'UNSUPPORTED_SOURCE' | 'ENGINE_CHECKING' | 'ENGINE_NEEDS_ACTION'; privacyDescription: string }
export const privacyDescription = 'Files are prepared locally. Relevant project text may be sent to Codex using your existing ChatGPT sign-in. Sensitive and ignored files are excluded.'
export function deriveLauncherState(codex: CodexStatusDto | undefined, source: LauncherSource, reading = false): CanonicalLauncherState {
  const engine = !codex || codex.status === 'checking' ? { status: 'checking' as const, displayName: 'Codex' } : codex.status === 'ready' ? { status: 'ready' as const, displayName: 'Codex' } : { status: codex.status === 'unavailable' ? 'unavailable' as const : 'needs-action' as const, displayName: 'Codex', recovery: codex.status === 'sign-in-required' ? 'Sign in to Codex to analyse a project.' : codex.error ?? 'Codex is unavailable.' }
  const sourceProblem = source?.kind === 'local' && source.support !== 'supported' ? source.support : undefined
  const view = reading ? 'READING_SOURCE' : !source ? 'EMPTY' : sourceProblem === 'failed' ? 'SOURCE_FAILED' : sourceProblem === 'too-large' ? 'SOURCE_TOO_LARGE' : sourceProblem === 'unsupported' ? 'UNSUPPORTED_SOURCE' : engine.status === 'checking' ? 'ENGINE_CHECKING' : engine.status === 'ready' ? 'READY' : 'ENGINE_NEEDS_ACTION'
  const disabledReason = view === 'READY' ? undefined : view === 'EMPTY' ? 'Choose a project or use the prepared sample.' : view === 'READING_SOURCE' ? 'Reading the selected project.' : engine.recovery ?? 'This project cannot be analysed yet.'
  return { source, engine, view, canAnalyse: view === 'READY', disabledReason, privacyDescription }
}
