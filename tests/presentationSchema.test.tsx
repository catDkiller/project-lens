import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeWorkspace } from '../src/app/KnowledgeWorkspace'
import type { PresentationKnowledgeBase } from '../src/knowledge'
import { deepGuideDemoPresentationKnowledge } from '../src/fixtures/deepGuideDemoPresentationKnowledge'

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

  it('renders bounded relationship and declaration views from deterministic evidence', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={{ version: '1.0', projectName: 'Small tool', files: [{ path: 'src/main.ts', explanation: 'Likely project entry point.', preview: 'import { service } from "./service"\n\nexport function run() {\n  return service()\n}' }, { path: 'src/service.ts', explanation: 'Provides the imported service.' }], projectParts: [{ id: 'entry', title: 'Entry points', relatedFiles: ['src/main.ts'] }], relationships: [{ fromPath: 'src/main.ts', toPath: 'src/service.ts', type: 'imports', status: 'analysed' }], symbols: [{ name: 'run', kind: 'function', signature: 'run()', path: 'src/main.ts', line: 3, analysisStatus: 'analysed' }] }} {...props} />)
    expect(markup).toContain('Evidence-backed project map')
    expect(markup).toContain('Responsibility tree')
    expect(markup).toContain('Repository tree')
    expect(markup).toContain('File connections')
    expect(markup).toContain('Important symbols')
    expect(markup).toContain('does not claim to be a')
    expect(markup).toContain('<dfn title="A call graph tracks which functions invoke other functions.')
    expect(markup).toContain('View code evidence')
    expect(markup).toContain('Copy excerpt')
    expect(markup).toContain('Static import')
  })

  it('uses the production workspace for the deterministic deep-guide fixture', () => {
    const markup = renderToStaticMarkup(<KnowledgeWorkspace knowledge={deepGuideDemoPresentationKnowledge} {...props} />)
    expect(markup).toContain('Test/demo report fixture')
    expect(markup).toContain('src/services/')
    expect(markup).toContain('src/services/userService.ts')
    expect(markup).toContain('entrypoint')
    expect(markup).toContain('Project glossary')
  })
})
