import { useMemo, useState } from 'react'
import type { ProjectAnalysis } from '../analysis'
import { findLearningPack } from '../learning'
import type { FeatureLearningPack } from '../learning'
import { createSearchResults } from './workspaceSearch'
import type { SearchResult, WorkspaceSection } from './workspaceSearch'

interface AnalysisWorkspaceProps { analysis: ProjectAnalysis; learningPacks: FeatureLearningPack[]; onRestart: () => void }

const navigation: { id: WorkspaceSection; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'project-parts', label: 'Project parts' }, { id: 'learning', label: 'What to learn' }, { id: 'review', label: 'Review before copying' }, { id: 'files', label: 'Files' },
]

export function AnalysisWorkspace({ analysis, learningPacks, onRestart }: AnalysisWorkspaceProps) {
  const [section, setSection] = useState<WorkspaceSection>('overview')
  const [featureId, setFeatureId] = useState(analysis.features[0]?.featureId ?? '')
  const [filePath, setFilePath] = useState(analysis.inventory.files[0]?.path ?? '')
  const [query, setQuery] = useState('')
  const feature = analysis.features.find((item) => item.featureId === featureId) ?? analysis.features[0]
  const pack = feature ? findLearningPack(feature.featureId, learningPacks) : undefined
  const file = analysis.inventory.files.find((item) => item.path === filePath)
  const relationships = analysis.relationships.filter((item) => item.fromPath === filePath)
  const results = useMemo(() => createSearchResults(analysis, learningPacks, query), [analysis, learningPacks, query])
  const technologies = [...new Set(learningPacks.flatMap((item) => item.concepts.map((concept) => concept.canonicalName)))].slice(0, 4)

  function selectFeature(id: string, nextSection: WorkspaceSection = 'project-parts') {
    const nextFeature = analysis.features.find((item) => item.featureId === id)
    setFeatureId(id)
    setFilePath(nextFeature?.relevantFiles[0]?.path ?? analysis.inventory.files[0]?.path ?? '')
    setSection(nextSection)
  }

  function selectResult(result: SearchResult) {
    if (result.featureId) selectFeature(result.featureId, result.section)
    else setSection(result.section)
    if (result.filePath) setFilePath(result.filePath)
    setQuery('')
  }

  return <main className="knowledge-workspace">
    <header className="top-bar">
      <strong>Project Lens</strong><span className="project-name">{analysis.project.name}</span>
      <div className="search-control"><label className="sr-only" htmlFor="knowledge-search">Search project knowledge</label><input id="knowledge-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project knowledge" />
        {query && <div className="search-results" role="listbox" aria-label="Search results">{results.length ? results.map((result) => <button key={result.id} type="button" role="option" onClick={() => selectResult(result)}><strong>{result.title}</strong><span>{result.detail}</span></button>) : <p>No matching project knowledge.</p>}</div>}
      </div>
      <button className="text-action" type="button" onClick={onRestart}>Restart</button>
    </header>
    <nav className="workspace-nav" aria-label="Project knowledge sections">{navigation.map((item) => <button className={section === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    <section className="workspace-content" aria-live="polite">
      {section === 'overview' && <Overview analysis={analysis} technologies={technologies} firstArea={analysis.features[0]?.label} />}
      {section === 'project-parts' && <ProjectParts analysis={analysis} feature={feature} pack={pack} onSelect={selectFeature} />}
      {section === 'learning' && <Learning feature={feature} pack={pack} />}
      {section === 'review' && <Review feature={feature} pack={pack} />}
      {section === 'files' && <Files analysis={analysis} file={file} filePath={filePath} relationships={relationships} onSelect={setFilePath} />}
      {section !== 'files' && <TechnicalDetails feature={feature} file={file} relationships={relationships} />}
    </section>
  </main>
}

function Overview({ analysis, technologies, firstArea }: { analysis: ProjectAnalysis; technologies: string[]; firstArea?: string }) {
  return <><p className="section-kicker">Project overview</p><h1>{analysis.project.name}</h1><p className="lede">A React/Vite project with {analysis.inventory.files.length} analysed files and {analysis.features.length} detected project parts.</p><dl className="overview-list"><div><dt>Framework</dt><dd>{analysis.project.framework}</dd></div><div><dt>Project parts</dt><dd>{analysis.features.map((item) => item.label).join(', ') || 'None detected'}</dd></div><div><dt>Important technologies</dt><dd>{technologies.join(', ') || 'Not reviewed yet'}</dd></div><div><dt>Start learning with</dt><dd>{firstArea ?? 'A detected project part'}</dd></div></dl></>
}

function ProjectParts({ analysis, feature, pack, onSelect }: { analysis: ProjectAnalysis; feature?: ProjectAnalysis['features'][number]; pack?: FeatureLearningPack; onSelect: (id: string) => void }) {
  return <><p className="section-kicker">Project parts</p><h1>What is in this project</h1><div className="part-list">{analysis.features.map((item) => <button className={item.featureId === feature?.featureId ? 'active' : ''} key={item.featureId} type="button" onClick={() => onSelect(item.featureId)}>{item.label}</button>)}</div>{feature && <div className="detail-view"><h2>{feature.label}</h2>{pack ? <><p className="lede">{pack.summary}</p><h3>Important files</h3><ul>{feature.relevantFiles.map((item) => <li key={item.path}>{item.path}</li>)}</ul><h3>Concepts used</h3><ul>{pack.concepts.map((item) => <li key={item.canonicalName}><strong>{item.canonicalName}</strong> — {item.plainExplanation}</li>)}</ul><h3>Learning order</h3><ol>{pack.learningSteps.map((item) => <li key={item.order}><strong>{item.topic}</strong> — {item.reason}</li>)}</ol><h3>Essential complexity</h3><Guidance items={pack.complexityItems.filter((item) => item.classification === 'essential')} /><h3>Review before copying</h3><Guidance items={pack.complexityItems.filter((item) => item.classification === 'review-before-copy')} /></> : <p>Learning content has not been reviewed for this feature yet.</p>}</div>}</>
}

function Learning({ feature, pack }: { feature?: ProjectAnalysis['features'][number]; pack?: FeatureLearningPack }) {
  return <><p className="section-kicker">What to learn</p><h1>{feature?.label ?? 'Select a project part'}</h1>{pack ? <><p className="lede">{pack.summary}</p><ol className="learning-order">{pack.learningSteps.map((item) => <li key={item.order}><strong>{item.topic}</strong><span>{item.reason}</span></li>)}</ol></> : <p>Learning content has not been reviewed for this feature yet.</p>}</>
}

function Review({ feature, pack }: { feature?: ProjectAnalysis['features'][number]; pack?: FeatureLearningPack }) {
  return <><p className="section-kicker">Review before copying</p><h1>{feature?.label ?? 'Select a project part'}</h1>{pack ? <Guidance items={pack.complexityItems.filter((item) => item.classification === 'review-before-copy')} /> : <p>Learning content has not been reviewed for this feature yet.</p>}</>
}

function Guidance({ items }: { items: FeatureLearningPack['complexityItems'] }) { return items.length ? <ul className="guidance-list">{items.map((item) => <li key={item.title}><strong>{item.title}</strong><span>{item.explanation}</span></li>)}</ul> : <p>No reviewed guidance is available.</p> }

function Files({ analysis, file, filePath, relationships, onSelect }: { analysis: ProjectAnalysis; file?: ProjectAnalysis['inventory']['files'][number]; filePath: string; relationships: ProjectAnalysis['relationships']; onSelect: (path: string) => void }) {
  return <><p className="section-kicker">Files</p><h1>Project files</h1><div className="file-list">{analysis.inventory.files.map((item) => <button className={item.path === filePath ? 'active' : ''} key={item.path} type="button" onClick={() => onSelect(item.path)}>{item.path}</button>)}</div><FileDetails file={file} relationships={relationships} /></>
}

function TechnicalDetails({ feature, file, relationships }: { feature?: ProjectAnalysis['features'][number]; file?: ProjectAnalysis['inventory']['files'][number]; relationships: ProjectAnalysis['relationships'] }) {
  return <aside className="technical-details"><details><summary>View technical evidence</summary>{feature && <><p>Confidence: {feature.confidence}</p><ul>{feature.relevantFiles.map((item) => <li key={item.path}><strong>{item.path}</strong> — score {item.score}<ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></li>)}</ul></>}</details><FileDetails file={file} relationships={relationships} /></aside>
}

function FileDetails({ file, relationships }: { file?: ProjectAnalysis['inventory']['files'][number]; relationships: ProjectAnalysis['relationships'] }) {
  return <>{file && <details><summary>View code excerpt</summary><pre><code>{file.content.split('\n').slice(0, 8).join('\n')}</code></pre></details>}<details><summary>View import relationships</summary>{relationships.length ? <ul>{relationships.map((item) => <li key={`${item.fromPath}-${item.specifier}`}>{item.specifier} — {item.resolution}{item.resolvedPath ? `: ${item.resolvedPath}` : ''}</li>)}</ul> : <p>No static imports from this file.</p>}</details></>
}
