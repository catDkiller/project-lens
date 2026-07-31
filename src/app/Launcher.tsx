import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AnalysisStageId } from '../analysis'
import { acceptsLocalPath, prepareLocalFiles } from '../project-sources/localFolderImport'
import type { ProjectFile } from '../project-sources/types'
import type { AgentStatusDto, ModelDto, ProviderDto } from '../local-api/contracts'
import type { Accent, Appearance } from './ThemeMenu'
import { ThemeMenu } from './ThemeMenu'
import { useControlMotion } from '../motion/useControlMotion'
import { useEntranceMotion } from '../motion/useEntranceMotion'

interface LauncherProps { agent?: AgentStatusDto; models: ModelDto[]; providers?: ProviderDto[]; runtimeStatus: string; isAnalysing: boolean; analysisStage?: AnalysisStageId; error?: string; appearance: Appearance; accent: Accent; onAppearance: (value: Appearance) => void; onAccent: (value: Accent) => void; onTrySample: (modelId: string) => void; onUsePrepared: () => void; onImportLocal: (name: string, files: ProjectFile[]) => void; onCancel: () => void; onRefreshProviders?: () => void; onRefreshModels?: () => void; onConnectProvider?: (providerId: string) => void; onDisconnectProvider?: (providerId: string) => void }
type DirectoryHandle = { name: string; values: () => AsyncIterableIterator<DirectoryHandle | FileSystemFileHandle>; kind: 'directory' }
type FileSystemFileHandle = { name: string; kind: 'file'; getFile: () => Promise<File> }
type FolderInput = HTMLInputElement & { webkitdirectory?: boolean }

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
  let skipped = 0
  const candidates: { path: string; content: string; size: number }[] = []
  for (const entry of entries) {
    if (!acceptsLocalPath(entry.path, entry.file.size)) { skipped++; continue }
    candidates.push({ path: entry.path, content: await entry.file.text(), size: entry.file.size })
  }
  const prepared = prepareLocalFiles(candidates)
  return { ...prepared, skipped: skipped + prepared.skipped }
}

function FolderIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3.5 6.5h6l1.7 2h9.3v9.7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z" /></svg> }
function Mark() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="m12 3 7 9-7 9-7-9 7-9Z" /></svg> }

export function Launcher({ agent, models = [], providers = [], runtimeStatus = 'Checking local runtime…', isAnalysing, analysisStage, error, appearance, accent, onAppearance, onAccent, onTrySample, onUsePrepared, onImportLocal, onCancel, onRefreshProviders = () => {}, onRefreshModels = () => {}, onConnectProvider = () => {}, onDisconnectProvider = () => {} }: LauncherProps) {
  const motionScope = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<FolderInput>(null)
  const wasPickerOpen = useRef(false)
  const [model, setModel] = useState(() => typeof localStorage === 'undefined' ? '' : localStorage.getItem('project-lens-model') ?? '')
  const [query, setQuery] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 8, width: 320 })
  const [folderStatus, setFolderStatus] = useState('')
  const selectedModel = models.some((item) => item.fullId === model) ? model : ''
  const selectedData = models.find((item) => item.fullId === selectedModel)
  const visibleModels = models.filter((item) => (!query || `${item.providerId} ${item.fullId}`.toLowerCase().includes(query.toLowerCase())) && (!freeOnly || item.free === true) && (!localOnly || item.local === true))
  const providersInResults = [...new Set(visibleModels.map((item) => item.providerId))]

  useEffect(() => { if (pickerRef.current) pickerRef.current.webkitdirectory = true }, [])
  useEffect(() => { if (selectedModel) localStorage.setItem('project-lens-model', selectedModel); else localStorage.removeItem('project-lens-model') }, [selectedModel])
  useEffect(() => {
    if (!pickerOpen) {
      if (wasPickerOpen.current) triggerRef.current?.focus()
      wasPickerOpen.current = false
      return
    }
    wasPickerOpen.current = true
    const close = (event: PointerEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !(event.target as Element).closest('.model-popover')) setPickerOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [pickerOpen])
  useEntranceMotion(motionScope, isAnalysing ? 'analysing' : 'launcher')
  useControlMotion(motionScope)

  function openModels() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 420)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 376)), width: Math.min(368, window.innerWidth - 16) })
    setPickerOpen((open) => !open)
  }
  function chooseModel(id: string) { setModel(id); setPickerOpen(false); setQuery('') }
  function onModelKey(event: React.KeyboardEvent<HTMLInputElement>) {
    const last = Math.max(visibleModels.length - 1, 0)
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((value) => Math.min(value + 1, last)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((value) => Math.max(value - 1, 0)) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0) }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(last) }
    else if (event.key === 'Enter' && visibleModels[activeIndex]) { event.preventDefault(); chooseModel(visibleModels[activeIndex].fullId) }
    else if (event.key === 'Tab') setPickerOpen(false)
  }
  async function chooseFolder() {
    setFolderStatus('')
    try {
      const chooser = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }).showDirectoryPicker
      if (!chooser) { pickerRef.current?.click(); return }
      const directory = await chooser()
      const prepared = await readLocalFiles(await fromDirectory(directory))
      if (!prepared.files.length) { setFolderStatus('No supported project text files were found.'); return }
      setFolderStatus(`${directory.name}: ${prepared.files.length} included, ${prepared.skipped} skipped, ${(prepared.size / 1024).toFixed(1)} KB`)
      onImportLocal(directory.name, prepared.files)
    } catch (reason) { setFolderStatus(reason instanceof DOMException && reason.name === 'AbortError' ? 'Folder selection cancelled.' : 'The folder could not be prepared locally.') }
  }
  async function fallbackFolder(event: React.ChangeEvent<HTMLInputElement>) {
    const entries = [...(event.target.files ?? [])].map((file) => ({ path: file.webkitRelativePath || file.name, file }))
    event.target.value = ''
    if (!entries.length) { setFolderStatus('Folder selection cancelled.'); return }
    const prepared = await readLocalFiles(entries)
    const name = entries[0].path.split('/')[0] || 'Local project'
    if (!prepared.files.length) { setFolderStatus('No supported project text files were found.'); return }
    setFolderStatus(`${name}: ${prepared.files.length} included, ${prepared.skipped} skipped, ${(prepared.size / 1024).toFixed(1)} KB`)
    onImportLocal(name, prepared.files)
  }

  const menu = pickerOpen && typeof document !== 'undefined' ? createPortal(<div className="model-popover" role="dialog" aria-label="Choose model" style={{ top: position.top, left: position.left, width: position.width }}><div className="model-popover-controls"><label htmlFor="modelSearch">Choose a model</label><input id="modelSearch" autoFocus type="search" placeholder="Search provider or model" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={onModelKey} /><div className="model-filters"><label><input type="checkbox" checked={freeOnly} onChange={(event) => { setFreeOnly(event.target.checked); setActiveIndex(0) }} /> Free only</label><label><input type="checkbox" checked={localOnly} onChange={(event) => { setLocalOnly(event.target.checked); setActiveIndex(0) }} /> Local only</label></div></div><div className="model-results" role="listbox" id="model-results" aria-label="Available OpenCode models">{providersInResults.map((provider) => <div className="model-provider-group" role="group" aria-label={provider} key={provider}><p>{provider}</p>{visibleModels.map((item, index) => item.providerId === provider && <button key={item.fullId} className={`model-option${item.fullId === selectedModel ? ' selected' : ''}${index === activeIndex ? ' highlighted' : ''}`} role="option" aria-selected={item.fullId === selectedModel} title={item.fullId} type="button" onMouseMove={() => setActiveIndex(index)} onClick={() => chooseModel(item.fullId)}><strong>{item.displayName}</strong><span>{item.fullId}{item.free ? ' · Free' : ''}{item.local ? ' · Local' : ''}</span></button>)}</div>)}{!visibleModels.length && <p className="model-empty">No models match these filters.</p>}</div></div>, document.body) : null

  return <main className="launcher-screen" ref={motionScope}><header className="launcher-header"><div className="brand-group"><span className="brand-mark"><Mark /></span><strong className="brand">Project Lens</strong></div><ThemeMenu appearance={appearance} accent={accent} onAppearance={onAppearance} onAccent={onAccent} /></header><section className="launcher-stage"><div className="launcher-copy-block" data-motion-enter><h1>Understand what was built.</h1><p className="launcher-copy">A calm workspace for opening a project, inspecting what matters, and learning from the implementation.</p></div><div className="lens-launcher" aria-label="Project launcher" data-motion-enter><button className="launcher-folder" type="button" onClick={() => void chooseFolder()}><span className="launcher-folder-icon"><FolderIcon /></span><span className="folder-label">Choose a project folder</span></button><input ref={pickerRef} className="folder-input" type="file" multiple onChange={(event) => void fallbackFolder(event)} /><div className="launcher-divider" /><div className="launcher-controls"><button ref={triggerRef} className="model-trigger" type="button" role="combobox" aria-expanded={pickerOpen} aria-controls="model-results" onClick={openModels}><span id="launcherPickerValue">{selectedData?.displayName ?? (agent?.installed ? 'Choose a model' : 'OpenCode unavailable')}</span></button>{menu}<button className="launcher-analyse" disabled={isAnalysing || !agent?.installed || !selectedModel} type="button" onClick={() => onTrySample(selectedModel)}>{isAnalysing ? 'Analysing…' : 'Analyse sample'}</button></div></div><p className="privacy-note">Files are prepared locally. Relevant project text may be sent by OpenCode to your selected model provider. Sensitive and ignored files are excluded.</p>{folderStatus && <p className="folder-status" role="status">{folderStatus}</p>}<div className="launcher-footer" data-motion-enter><button className="link-sample" disabled={isAnalysing} type="button" onClick={onUsePrepared}>Use prepared sample <span aria-hidden="true">→</span></button><span className="launcher-status">{runtimeStatus}</span></div><details className="launcher-settings"><summary>Settings · AI providers</summary><div className="launcher-settings-body"><p>OpenCode owns provider credentials. Project Lens never collects or stores API keys.</p>{providers.map((provider) => <div className="provider-row" key={provider.id}><span>{provider.displayName} · {provider.connected ? 'Connected' : 'Not connected'}</span>{provider.connected ? <button type="button" onClick={() => onDisconnectProvider(provider.id)}>Disconnect</button> : <button type="button" onClick={() => onConnectProvider(provider.id)}>Connect through OpenCode</button>}</div>)}<div className="provider-actions"><button type="button" onClick={onRefreshProviders}>Refresh providers</button><button type="button" onClick={onRefreshModels}>Refresh models</button></div></div></details>{error && <p className="error-state" role="alert">{error}</p>}{isAnalysing && <p className="analysis-activity" role="status">{analysisStage ? `Checking ${analysisStage}…` : 'Analysing with OpenCode…'} <button type="button" className="link-sample" onClick={onCancel}>Cancel</button></p>}</section></main>
}
