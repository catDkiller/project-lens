import { describe, expect, it } from 'vitest'
import { runProjectAnalysis } from '../src/analysis'
import { createProjectKnowledgeBase, createCodexEvidencePrompt, buildPresentationKnowledgeBase, parseCodexInsights } from '../src/knowledge'
import type { NormalizedProject } from '../src/project-sources/types'

const python: NormalizedProject = { id: 'python-tool', name: 'Python Tool', framework: 'Python', files: [{ path: 'pyproject.toml', content: '[project]\ndependencies=["requests"]' }, { path: 'app/main.py', content: 'import requests\nprint("hello")' }, { path: 'tests/test_main.py', content: 'def test_main(): pass' }] }
const typescript: NormalizedProject = { id: 'ts-service', name: 'TypeScript Service', framework: 'JavaScript/TypeScript', files: [{ path: 'package.json', content: '{"dependencies":{"express":"1.0.0"}}' }, { path: 'src/server.ts', content: 'import express from "express"\nexport const app = express()' }, { path: 'src/index.ts', content: 'import { app } from "./server"' }] }

async function knowledge(project: NormalizedProject) { return createProjectKnowledgeBase(await runProjectAnalysis(project, [], () => undefined), [], 'Selected folder') }

describe('generic selected-folder evidence', () => {
  it('keeps substantially different projects separate without sample assumptions', async () => {
    const [pythonKnowledge, typescriptKnowledge] = await Promise.all([knowledge(python), knowledge(typescript)])
    expect(pythonKnowledge.name).not.toBe(typescriptKnowledge.name)
    expect(pythonKnowledge.detectedLanguages).toContain('Python')
    expect(typescriptKnowledge.detectedLanguages).toContain('TypeScript')
    expect(pythonKnowledge.detectedLanguages).not.toContain('TypeScript')
    expect(pythonKnowledge.technologies).toContain('requests')
    expect(typescriptKnowledge.technologies).toContain('express')
    expect(pythonKnowledge.importantFiles?.map((file) => file.path)).not.toContain('src/App.tsx')
    expect(pythonKnowledge.sourceFingerprint).not.toBe(typescriptKnowledge.sourceFingerprint)
    expect(createCodexEvidencePrompt(pythonKnowledge)).not.toBe(createCodexEvidencePrompt(typescriptKnowledge))
    expect(JSON.stringify(buildPresentationKnowledgeBase(pythonKnowledge))).not.toContain('prepared-sample-project')
    expect(JSON.stringify(buildPresentationKnowledgeBase(pythonKnowledge))).not.toContain('src/App.tsx')
  })

  it('builds a valid deterministic presentation when optional Codex insights are absent', async () => {
    const result = buildPresentationKnowledgeBase(await knowledge(typescript))
    expect(result.projectName).toBe('TypeScript Service')
    expect(result.projectTypeLabel).toBe('JavaScript/TypeScript')
    expect(result.files?.map((file) => file.path)).toEqual(expect.arrayContaining(['package.json', 'src/index.ts']))
  })

  it('discards optional Codex paths that are not in the selected-folder manifest', async () => {
    const base = await knowledge(typescript)
    const parsed = parseCodexInsights({ summary: 'Summary', architecture: 'Architecture', importantFiles: [{ path: 'missing.ts', explanation: 'ignore' }, { path: 'src/index.ts', explanation: 'entry' }], learningSteps: [{ title: 'Start', explanation: 'Read the entry point.', relatedFiles: ['missing.ts', 'src/index.ts'] }] }, base)
    expect(parsed.issues).toEqual([])
    expect(parsed.insights?.importantFiles?.map((file) => file.path)).toEqual(['src/index.ts'])
    expect(parsed.insights?.learningSteps?.[0]?.relatedFiles).toEqual(['src/index.ts'])
  })
})
