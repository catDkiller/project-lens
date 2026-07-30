import { useEffect, useState } from 'react'
import { runProjectAnalysis } from '../analysis'
import type { ProjectAnalysis } from '../analysis'
import { preparedSampleFeatureDefinitions } from '../fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleAgents } from '../fixtures/launcherDemo'
import { preparedSampleLearningPacks } from '../fixtures/preparedSampleLearningPacks'
import { createProjectKnowledgeBase, createPresentationFallback, validatePresentationKnowledgeBase } from '../knowledge'
import type { PresentationKnowledgeBase } from '../knowledge'
import { preparedSamplePresentationKnowledge } from '../fixtures/preparedSamplePresentationKnowledge'
import { bundledSampleProjectSource } from '../project-sources/BundledSampleProjectSource'
import { Launcher } from './Launcher'
import { KnowledgeWorkspace } from './KnowledgeWorkspace'
import type { Accent, Appearance } from './ThemeMenu'
import './app.css'

type AppMode = 'launcher' | 'analysing' | 'workspace'

export function App() {
  const [mode, setMode] = useState<AppMode>('launcher')
  const [knowledge, setKnowledge] = useState<PresentationKnowledgeBase | null>(null)
  const [error, setError] = useState<string>()
  const [appearance, setAppearance] = useState<Appearance>(() => typeof localStorage === 'undefined' ? 'light' : localStorage.getItem('project-lens-appearance') as Appearance || 'light')
  const [accent, setAccent] = useState<Accent>(() => typeof localStorage === 'undefined' ? 'blue' : localStorage.getItem('project-lens-accent') as Accent || 'blue')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    document.documentElement.dataset.accent = accent
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('project-lens-appearance', appearance)
      localStorage.setItem('project-lens-accent', accent)
    }
  }, [appearance, accent])

  async function analyseSample() {
    setMode('analysing')
    setError(undefined)
    try {
      const project = await bundledSampleProjectSource.load()
      const analysis: ProjectAnalysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, () => {}, 120)
      const rawKnowledge = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Sample')
      setKnowledge(validatePresentationKnowledgeBase(preparedSamplePresentationKnowledge, rawKnowledge).length ? createPresentationFallback(rawKnowledge) : preparedSamplePresentationKnowledge)
      setMode('workspace')
    } catch {
      setError('The prepared sample could not be analysed. Try again.')
      setMode('launcher')
    }
  }

  function returnToLauncher() { setKnowledge(null); setMode('launcher') }
  if (mode === 'workspace' && knowledge) return <KnowledgeWorkspace knowledge={knowledge} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onReturn={returnToLauncher} onReanalyse={analyseSample} />
  return <Launcher agents={preparedSampleAgents} isAnalysing={mode === 'analysing'} error={error} appearance={appearance} accent={accent} onAppearance={setAppearance} onAccent={setAccent} onTrySample={analyseSample} />
}
