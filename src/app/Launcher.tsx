import { useRef, useState } from 'react'
import type { AnalysisStageId } from '../analysis'
import type { LauncherAgentOption } from '../fixtures/launcherDemo'
import type { Accent, Appearance } from './ThemeMenu'
import { ThemeMenu } from './ThemeMenu'
import { useControlMotion } from '../motion/useControlMotion'
import { useEntranceMotion } from '../motion/useEntranceMotion'

interface LauncherProps {
  agents: LauncherAgentOption[]
  isAnalysing: boolean
  analysisStage?: AnalysisStageId
  error?: string
  appearance: Appearance
  accent: Accent
  onAppearance: (value: Appearance) => void
  onAccent: (value: Accent) => void
  onTrySample: () => void
}

export function Launcher({
  agents,
  isAnalysing,
  analysisStage,
  error,
  appearance,
  accent,
  onAppearance,
  onAccent,
  onTrySample,
}: LauncherProps) {
  const motionScope = useRef<HTMLElement>(null)
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [model, setModel] = useState(agents[0]?.models[0] ?? '')
  const selectedAgent = agents.find((item) => item.id === agentId) ?? agents[0]
  const selectedModels = selectedAgent?.models ?? []
  const selectedModel = selectedModels.includes(model) ? model : selectedModels[0] ?? ''
  useEntranceMotion(motionScope, isAnalysing ? 'analysing' : 'launcher')
  useControlMotion(motionScope)

  return (
    <main className="launcher-screen" ref={motionScope}>
      <header className="launcher-header">
        <div className="brand-group">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5l5 2.8v7.4L8 14.5 3 11.7V4.3l5-2.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 4.2v7.6M5 6.4l3 1.7 3-1.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <strong className="brand">Project Lens</strong>
        </div>
        <ThemeMenu appearance={appearance} accent={accent} onAppearance={onAppearance} onAccent={onAccent} />
      </header>

      <section className="launcher-stage">
        <div className="launcher-copy-block" data-motion-enter>
          <h1>Understand what was built.</h1>
          <p className="launcher-copy">A calm workspace for opening a project, inspecting what matters, and learning from the implementation.</p>
        </div>

        <div className="lens-launcher" aria-label="Prepared sample launcher" data-motion-enter>
          <button className="launcher-folder" disabled type="button">
            <span className="launcher-folder-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M1.5 4.5h4l1.3 1.6h7.7v5.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="folder-label">Choose a project folder</span>
          </button>
          <div className="launcher-divider" />
          <div className="launcher-controls">
            <details className="launcher-picker">
              <summary aria-label="Choose AI CLI and model">
                <span className="picker-summary-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <span id="launcherPickerValue">{selectedAgent?.name ?? 'Built-in sample analysis'} · {selectedModel || 'Model'}</span>
              </summary>
              <div className="launcher-picker-menu">
                <div className="launcher-picker-field">
                  <label htmlFor="selectCLI">AI CLI</label>
                  <select id="selectCLI" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                    {agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div className="launcher-picker-field">
                  <label htmlFor="selectModel">Model</label>
                  <select id="selectModel" value={selectedModel} onChange={(event) => setModel(event.target.value)}>
                    {selectedModels.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
            </details>
            <button className="launcher-analyse" disabled={isAnalysing} type="button" onClick={onTrySample}>
              {isAnalysing ? 'Analysing…' : 'Analyse'}
            </button>
          </div>
        </div>

        <div className="launcher-footer" data-motion-enter>
          <button className="link-sample" disabled={isAnalysing} type="button" onClick={onTrySample}>
            Try a sample project <span aria-hidden="true">→</span>
          </button>
          <span className="launcher-status">Local folder support is being connected</span>
        </div>

        {error && <p className="error-state" role="alert">{error}</p>}
        {isAnalysing && <p className="analysis-activity" data-motion-enter role="status"><span aria-hidden="true" />{analysisStage ? `Checking ${analysisStage}…` : 'Preparing analysis…'}</p>}
      </section>
    </main>
  )
}
