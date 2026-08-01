import { useEffect, useRef, useState } from 'react'
import { acceptsLocalPath, classifyLocalPath, prepareLocalFiles } from '../project-sources/localFolderImport'
import type { LocalSkipReason } from '../project-sources/localFolderImport'
import { assessLocalProject } from '../project-sources/support'
import type { ProjectFile } from '../project-sources/types'
import type { CanonicalLauncherState, LauncherSource } from './launcherState'

type DirectoryHandle = { name: string; values: () => AsyncIterableIterator<DirectoryHandle | FileSystemFileHandle>; kind: 'directory' }
type FileSystemFileHandle = { name: string; kind: 'file'; getFile: () => Promise<File> }
type FolderInput = HTMLInputElement & { webkitdirectory?: boolean }
type PreparedFiles = Awaited<ReturnType<typeof readLocalFiles>>

async function fromDirectory(handle: DirectoryHandle, prefix = ''): Promise<{ path: string; file: File }[]> {
  const found: { path: string; file: File }[] = []
  for await (const child of handle.values()) {
    const childPath = `${prefix}${child.name}`
    if (child.kind === 'directory') found.push(...await fromDirectory(child as DirectoryHandle, `${childPath}/`))
    else found.push({ path: childPath, file: await (child as FileSystemFileHandle).getFile() })
  }
  return found
}

async function readLocalFiles(entries: { path: string; file: File }[]) {
  const skippedByReason: Record<LocalSkipReason, number> = { 'dependency-generated': 0, sensitive: 0, 'binary-unsupported': 0, oversized: 0, unsafe: 0 }
  const candidates: { path: string; content: string; size: number }[] = []
  for (const entry of entries) {
    const reason = classifyLocalPath(entry.path, entry.file.size)
    if (!acceptsLocalPath(entry.path, entry.file.size)) { if (reason) skippedByReason[reason]++; continue }
    candidates.push({ path: entry.path, content: await entry.file.text(), size: entry.file.size })
  }
  const prepared = prepareLocalFiles(candidates)
  for (const key of Object.keys(skippedByReason) as LocalSkipReason[]) skippedByReason[key] += prepared.skippedByReason[key]
  return { ...prepared, skipped: Object.values(skippedByReason).reduce((total, count) => total + count, 0), skippedByReason }
}

interface Props {
  state: Omit<CanonicalLauncherState, 'source'> & { source: LauncherSource; activeRuntime?: { displayName: string }; execution?: { fullId: string } }
  onUsePrepared: () => void
  onImportLocal: (name: string, files: ProjectFile[], summary: string, skipped: Record<LocalSkipReason, number>, support: 'supported' | 'unsupported' | 'too-large' | 'failed', diagnostics?: string[]) => void
  onSourceReading?: (reading: boolean) => void
  onAnalyse: () => void
}

export function ReleaseLauncher({ state, onUsePrepared, onImportLocal, onSourceReading, onAnalyse }: Props) {
  const pickerRef = useRef<FolderInput>(null)
  const [pickerStatus, setPickerStatus] = useState('')
  const [reading, setReading] = useState(false)
  useEffect(() => { if (pickerRef.current) pickerRef.current.webkitdirectory = true }, [])

  const finish = (name: string, prepared: PreparedFiles) => {
    const assessment = assessLocalProject(prepared.files)
    const summary = `${prepared.files.length} included · ${prepared.skipped} skipped · ${(prepared.size / 1024 / 1024).toFixed(2)} MB`
    if (!prepared.files.length) { setPickerStatus('No supported project text files were found.'); onImportLocal(name, [], summary, prepared.skippedByReason, 'failed', ['No approved project files were found.']); return }
    setPickerStatus(assessment.support === 'supported' ? summary : assessment.support === 'too-large' ? 'Project is too large to prepare safely.' : 'Project type is not supported yet.')
    onImportLocal(name, prepared.files, summary, prepared.skippedByReason, assessment.support, assessment.evidence)
  }

  const choose = async () => {
    setReading(true); onSourceReading?.(true)
    try {
      const chooser = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }).showDirectoryPicker
      if (!chooser) { pickerRef.current?.click(); return }
      const directory = await chooser()
      finish(directory.name, await readLocalFiles(await fromDirectory(directory)))
    } catch (error) {
      setPickerStatus(error instanceof DOMException && error.name === 'AbortError' ? 'Folder selection cancelled.' : 'The folder could not be prepared locally.')
    } finally { setReading(false); onSourceReading?.(false) }
  }

  const fallback = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setReading(true); onSourceReading?.(true)
    const entries = [...(event.target.files ?? [])].map((file) => ({ path: file.webkitRelativePath || file.name, file }))
    event.target.value = ''
    if (entries.length) finish(entries[0].path.split('/')[0] || 'Local project', await readLocalFiles(entries))
    else setPickerStatus('Folder selection cancelled.')
    setReading(false); onSourceReading?.(false)
  }

  const source = state.source
  const selectedName = source?.kind === 'prepared' ? 'Prepared React/Vite sample' : source?.kind === 'local' ? source.name : undefined
  const sourceMessage = state.view === 'READING_SOURCE' ? `Reading ${selectedName ?? 'selected project'}…` : source?.kind === 'local' && source.support === 'unsupported' ? 'This project is not a supported React/Vite project.' : source?.kind === 'local' && source.support === 'too-large' ? 'This project is too large to prepare safely.' : source?.kind === 'local' && source.support === 'failed' ? 'The project could not be prepared. Try choosing it again.' : source?.kind === 'local' && source.summary ? source.summary : source?.kind === 'prepared' ? 'Prepared React/Vite sample · ready to analyse' : 'No project selected yet.'
  const engineMessage = state.engine.status === 'ready' ? `${state.engine.displayName ?? 'AI engine'} · Ready` : state.engine.status === 'checking' ? 'Checking the active AI engine…' : state.engine.recovery ?? 'The AI engine needs attention.'
  const disabledReason = state.canAnalyse || state.engine.status !== 'ready' ? undefined : state.disabledReason

  return <main className="launcher-screen"><header className="launcher-header"><strong className="brand">Project Lens</strong></header><section className="launcher-stage"><div className="launcher-copy-block"><h1>Understand what was built.</h1><p className="launcher-copy">Choose a project and Project Lens will explain how it works.</p></div><div className="lens-launcher release-launcher" aria-label="Project launcher"><p className="launcher-section-label">Project</p><div className="launcher-project-control"><button className="launcher-folder" type="button" aria-label={selectedName ? `Replace ${selectedName}` : 'Choose project folder'} onClick={() => void choose()} disabled={reading}><span className="folder-label">{selectedName ?? 'Choose project folder'}</span><span aria-hidden="true">{reading ? 'Reading…' : 'Choose'}</span></button><input ref={pickerRef} className="folder-input" type="file" multiple onChange={(event) => void fallback(event)} /></div><button className="link-sample" type="button" onClick={onUsePrepared} disabled={reading}>Use prepared sample</button><p className="folder-status" role="status" aria-live="polite">{sourceMessage}</p>{pickerStatus && <p className="folder-status" role="status">{pickerStatus}</p>}<p className="local-support">Only React/Vite projects are supported for local analysis.</p><div className="launcher-divider" /><p className="launcher-section-label">AI engine</p><p className="ai-ready" role="status" aria-live="polite">{engineMessage}</p><button className="launcher-analyse" type="button" disabled={!state.canAnalyse || reading} onClick={onAnalyse}>{state.view === 'READY' && source?.kind === 'prepared' ? 'Analyse sample' : 'Analyse project'}</button>{disabledReason && <p className="folder-status launcher-disabled-reason" role="status">{disabledReason}</p>}</div><p className="privacy-note">{state.privacyDescription}</p></section></main>
}
