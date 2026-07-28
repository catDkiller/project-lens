import { useState } from 'react'
import type { ProjectAnalysis } from '../analysis'
import { findLearningPack } from '../learning'
import type { FeatureLearningPack } from '../learning'

interface AnalysisWorkspaceProps {
  analysis: ProjectAnalysis
  learningPacks: FeatureLearningPack[]
}

export function AnalysisWorkspace({ analysis, learningPacks }: AnalysisWorkspaceProps) {
  const [selectedFeatureId, setSelectedFeatureId] = useState(analysis.features[0]?.featureId ?? '')
  const selectedFeature = analysis.features.find((feature) => feature.featureId === selectedFeatureId) ?? analysis.features[0]
  const [selectedFilePath, setSelectedFilePath] = useState(selectedFeature?.relevantFiles[0]?.path ?? '')
  const selectedFile = analysis.inventory.files.find((file) => file.path === selectedFilePath)
    ?? analysis.inventory.files.find((file) => file.path === selectedFeature?.relevantFiles[0]?.path)
  const selectedRelationships = analysis.relationships.filter((relationship) => relationship.fromPath === selectedFile?.path)
  const learningPack = selectedFeature ? findLearningPack(selectedFeature.featureId, learningPacks) : undefined

  function selectFeature(featureId: string) {
    const feature = analysis.features.find((item) => item.featureId === featureId)
    setSelectedFeatureId(featureId)
    setSelectedFilePath(feature?.relevantFiles[0]?.path ?? '')
  }

  return (
    <section className="analysis-workspace" aria-labelledby="workspace-heading">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Analysis complete</p>
          <h2 id="workspace-heading">{analysis.project.name}</h2>
          <p>{analysis.project.framework} · {analysis.inventory.files.length} files · {analysis.importCount} static imports</p>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="workspace-panel" aria-labelledby="feature-heading">
          <label htmlFor="feature-select" id="feature-heading">Detected feature</label>
          <select id="feature-select" value={selectedFeature?.featureId ?? ''} onChange={(event) => selectFeature(event.target.value)}>
            {analysis.features.map((feature) => <option key={feature.featureId} value={feature.featureId}>{feature.label}</option>)}
          </select>
          {selectedFeature && <p className="confidence">Confidence: <strong>{selectedFeature.confidence}</strong></p>}

          <h3>Relevant files</h3>
          <div className="file-list">
            {selectedFeature?.relevantFiles.map((file) => (
              <button
                className={file.path === selectedFile?.path ? 'file-button selected' : 'file-button'}
                key={file.path}
                type="button"
                onClick={() => setSelectedFilePath(file.path)}
              >
                <span>{file.path}</span><strong>{file.score}</strong>
              </button>
            ))}
            {selectedFeature?.relevantFiles.length === 0 && <p className="empty-state">No evidence-backed files were found for this feature.</p>}
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="file-details-heading">
          <h3 id="file-details-heading">{selectedFile?.path ?? 'Select a file'}</h3>
          {selectedFeature?.relevantFiles.find((file) => file.path === selectedFile?.path)?.reasons.map((reason) => (
            <p className="evidence" key={reason}>{reason}</p>
          ))}

          <h4>Imports from this file</h4>
          {selectedRelationships.length > 0 ? (
            <ul className="relationship-list">
              {selectedRelationships.map((relationship) => <li key={`${relationship.fromPath}-${relationship.specifier}`}>{relationship.specifier} — {relationship.resolution}</li>)}
            </ul>
          ) : <p className="empty-state">No static imports from this file.</p>}

          <h4>Code excerpt</h4>
          <pre><code>{selectedFile?.content.split('\n').slice(0, 6).join('\n') ?? ''}</code></pre>
        </section>

        <section className="workspace-panel learning-panel" aria-labelledby="learning-heading">
          <h3 id="learning-heading">Learning guidance</h3>
          {learningPack ? (
            <>
              <p className="learning-summary">{learningPack.summary}</p>

              <h4>Concepts</h4>
              <div className="learning-list">
                {learningPack.concepts.map((concept) => (
                  <article key={concept.canonicalName}>
                    <h5>{concept.canonicalName}</h5>
                    <p>{concept.plainExplanation}</p>
                    <p className="learning-detail">{concept.whyItExists}</p>
                  </article>
                ))}
              </div>

              <h4>Essential complexity</h4>
              <div className="learning-list">
                {learningPack.complexityItems.filter((item) => item.classification === 'essential').map((item) => (
                  <article key={item.title}><h5>{item.title}</h5><p>{item.explanation}</p></article>
                ))}
              </div>

              <h4>Review before copying</h4>
              <div className="learning-list">
                {learningPack.complexityItems.filter((item) => item.classification === 'review-before-copy').map((item) => (
                  <article key={item.title}><h5>{item.title}</h5><p>{item.explanation}</p></article>
                ))}
              </div>

              <h4>Learn first</h4>
              <ol className="learning-steps">
                {learningPack.learningSteps.map((step) => <li key={step.order}><strong>{step.topic}</strong> — {step.reason}</li>)}
              </ol>
            </>
          ) : <p className="empty-state">Learning content has not been reviewed for this feature yet.</p>}
        </section>
      </div>
    </section>
  )
}
