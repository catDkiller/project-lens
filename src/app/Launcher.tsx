import { useRef, useState } from 'react'
import type { AnalysisStageId } from '../analysis'
import type { AgentStatusDto, ModelDto } from '../local-api/contracts'
import type { Accent, Appearance } from './ThemeMenu'
import { ThemeMenu } from './ThemeMenu'
import { useControlMotion } from '../motion/useControlMotion'
import { useEntranceMotion } from '../motion/useEntranceMotion'

interface LauncherProps {
  agent?: AgentStatusDto
  models: ModelDto[]
  runtimeStatus: string
  isAnalysing: boolean
  analysisStage?: AnalysisStageId
  error?: string
  appearance: Appearance
  accent: Accent
  onAppearance: (value: Appearance) => void
  onAccent: (value: Accent) => void
  onTrySample: (modelId: string) => void
  onUsePrepared: () => void
  onCancel: () => void
}

export function Launcher({ agent, models = [], runtimeStatus = 'Checking local runtime…', isAnalysing, analysisStage, error, appearance, accent, onAppearance, onAccent, onTrySample, onUsePrepared, onCancel }: LauncherProps) {
  const motionScope = useRef<HTMLElement>(null)
  const [model, setModel] = useState('')
  const selectedModel = models.some((item) => item.fullId === model) ? model : models[0]?.fullId ?? ''
  useEntranceMotion(motionScope, isAnalysing ? 'analysing' : 'launcher')
  useControlMotion(motionScope)

  return <main className="launcher-screen" ref={motionScope}>
    <header className="launcher-header">
      <div className="brand-group"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5 2.8v7.4L8 14.5 3 11.7V4.3l5-2.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 4.2v7.6M5 6.4l3 1.7 3-1.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></span><strong className="brand">Project Lens</strong></div>
      <ThemeMenu appearance={appearance} accent={accent} onAppearance={onAppearance} onAccent={onAccent} />
    </header>
    <section className="launcher-stage">
      <div className="launcher-copy-block" data-motion-enter><h1>Understand what was built.</h1><p className="launcher-copy">A calm workspace for opening a project, inspecting what matters, and learning from the implementation.</p></div>
      <div className="lens-launcher" aria-label="Prepared sample launcher" data-motion-enter>
        <button className="launcher-folder" disabled type="button"><span className="launcher-folder-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M1.5 4.5h4l1.3 1.6h7.7v5.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg></span><span className="folder-label">Choose a project folder</span></button>
        <div className="launcher-divider" />
        <div className="launcher-controls">
          <details className="launcher-picker"><summary aria-label="Choose AI CLI and model"><span className="picker-summary-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg></span><span id="launcherPickerValue">{agent?.installed ? 'OpenCode' : 'OpenCode unavailable'} · {selectedModel || 'No model'}</span></summary>
            <div className="launcher-picker-menu"><div className="launcher-picker-field"><label htmlFor="selectCLI">AI CLI</label><select id="selectCLI" value="opencode" disabled><option value="opencode">OpenCode</option></select></div><div className="launcher-picker-field"><label htmlFor="selectModel">Model</label><select id="selectModel" value={selectedModel} onChange={(event) => setModel(event.target.value)} disabled={!models.length}>{!models.length && <option value="">No model available</option>}{models.map((item) => <option key={item.fullId} value={item.fullId}>{item.displayName}</option>)}</select></div></div>
          </details>
          <button className="launcher-analyse" disabled={isAnalysing || !agent?.installed || !selectedModel} type="button" onClick={() => onTrySample(selectedModel)}>{isAnalysing ? 'Analysing…' : 'Analyse sample'}</button>
        </div>
      </div>
      <div className="launcher-footer" data-motion-enter><button className="link-sample" disabled={isAnalysing} type="button" onClick={onUsePrepared}>Use prepared sample <span aria-hidden="true">→</span></button><span className="launcher-status">{runtimeStatus}</span></div>
      {error && <p className="error-state" role="alert">{error}</p>}
      {isAnalysing && <p className="analysis-activity" data-motion-enter role="status"><span aria-hidden="true" />{analysisStage ? `Checking ${analysisStage}…` : 'Analysing with OpenCode…'} <button type="button" className="link-sample" onClick={onCancel}>Cancel</button></p>}
    </section>
  </main>
}
