import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeWorkspace } from '../src/app/KnowledgeWorkspace'
import type { PresentationKnowledgeBase } from '../src/knowledge'

const props = { appearance: 'light' as const, accent: 'blue' as const, onAppearance: vi.fn(), onAccent: vi.fn(), onReturn: vi.fn(), onReanalyse: vi.fn() }

describe('provider-independent presentation schema', () => {
  const examples: PresentationKnowledgeBase[] = [
    { version: '1.0', projectName: 'Model trainer', projectTypeLabel: 'Python machine-learning project', overview: { whatItIs: 'A project that prepares and trains a model.' }, files: [{ path: 'train.py', explanation: 'Starts model training.' }] },
    { version: '1.0', projectName: 'Release helper', projectTypeLabel: 'Command-line tool', overview: { whatItIs: 'A tool run from a terminal.' }, files: [{ path: 'src/cli.ts', explanation: 'Reads command-line options.' }] },
    { version: '1.0', projectName: 'Media lab', projectTypeLabel: 'Mixed project', overview: { whatItIs: 'A project with code and media files.' }, files: [{ path: 'assets/demo.png', explanation: 'The file was found, but its exact role could not be confirmed.', itemType: 'asset', analysisStatus: 'uncertain' }, { path: 'assets/model.bin', explanation: 'The file was found, but its contents are not supported.', itemType: 'binary', analysisStatus: 'unsupported' }] },
  ]

  it.each(examples)('renders $projectTypeLabel without web-specific wording', (knowledge) => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={knowledge} {...props} />)
    expect(markup).toContain(knowledge.projectName)
    expect(markup).toContain(knowledge.projectTypeLabel)
  })
})
