import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { analysisEnvironment, buildAnalysisArgs, buildProjectRequestFile, extractOpenCodeText, runOpenCode } from '../src/local-api/opencode'
import { changedFiles, createProjectAnalysisWorkspace, fileManifest, removeAnalysisWorkspace } from '../src/local-api/analysisWorkspace'
import { localProject, prepareLocalFiles } from '../src/project-sources/localFolderImport'
import { runProjectAnalysis } from '../src/analysis'
import { preparedSampleFeatureDefinitions } from '../src/fixtures/preparedSampleFeatureDefinitions'
import { preparedSampleLearningPacks } from '../src/fixtures/preparedSampleLearningPacks'
import { preparedViteSample } from '../src/fixtures/preparedViteSample'
import { createPresentationFallback, createProjectKnowledgeBase, validatePresentationKnowledgeBase } from '../src/knowledge'

const fakeExecutable = process.execPath
const fakeScript = path.resolve('tests/fixtures/fake-opencode.mjs')
const cleanupDirs: string[] = []

afterEach(async () => {
  await Promise.all(cleanupDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true, maxRetries: 3 })))
})

async function buildHarness() {
  const prepared = prepareLocalFiles([
    ...preparedViteSample.files.map((file) => ({ path: file.path, content: file.content, size: new TextEncoder().encode(file.content).byteLength })),
    { path: '.env.local', content: 'SECRET=value', size: 12 },
  ])
  const project = localProject('Imported local demo', prepared.files)
  const analysis = await runProjectAnalysis(project, preparedSampleFeatureDefinitions, () => {})
  const raw = createProjectKnowledgeBase(analysis, preparedSampleLearningPacks, 'Local folder')
  const workspace = await createProjectAnalysisWorkspace(prepared.files)
  cleanupDirs.push(workspace.directory, workspace.source)
  const requestDirectory = await mkdtemp(path.join(tmpdir(), 'project-lens-request-'))
  cleanupDirs.push(requestDirectory)
  const requestFile = path.join(requestDirectory, '.project-lens-request.json')
  await writeFile(requestFile, buildProjectRequestFile(raw, true), 'utf8')
  const presentation = createPresentationFallback(raw)
  return { raw, workspace, requestDirectory, requestFile, presentation }
}

describe('OpenCode process harness', () => {
  it('runs the exact opencode invocation with streamed events and preserves the workspace', async () => {
    const harness = await buildHarness()
    const events: Record<string, unknown>[] = []
    const startedPids: number[] = []
    const exitedCodes: Array<number | null> = []
    const before = await fileManifest(harness.workspace.directory)
    const result = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'success', PROJECT_LENS_FAKE_FINAL_OUTPUT: JSON.stringify(harness.presentation), PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
      onProcessStarted: (pid) => startedPids.push(pid),
      onProcessExited: (code) => exitedCodes.push(code),
      onStdoutEvent: (event) => events.push(event),
    })

    expect(result.code).toBe(0)
    expect(startedPids).toHaveLength(1)
    expect(startedPids[0]).toBeGreaterThan(0)
    expect(exitedCodes).toEqual([0])
    expect(events.some((event) => event.type === 'web-research' && event.outcome === 'used-successfully')).toBe(true)
    expect(validatePresentationKnowledgeBase(JSON.parse(extractOpenCodeText(result.stdout)), harness.raw)).toEqual([])
    expect(changedFiles(before, await fileManifest(harness.workspace.directory))).toEqual([])
    await rm(harness.requestDirectory, { recursive: true, force: true, maxRetries: 3 })
    await removeAnalysisWorkspace(harness.workspace.directory, harness.workspace.source)
    expect(await readFile(harness.requestFile, 'utf8').then(() => true, () => false)).toBe(false)
  })

  it('parses fragmented stdout, delayed first response, and multi-event chunks', async () => {
    const harness = await buildHarness()
    const collected: string[] = []
    const fragmented = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'fragmented-ndjson', PROJECT_LENS_FAKE_FINAL_OUTPUT: JSON.stringify(harness.presentation), PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
      onStdoutEvent: (event) => collected.push(String(event.type ?? 'unknown')),
    })
    expect(fragmented.code).toBe(0)
    expect(collected).toEqual(expect.arrayContaining(['queued', 'analysing', 'web-research']))

    const delayed = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'delayed-first-response', PROJECT_LENS_FAKE_FINAL_OUTPUT: JSON.stringify(harness.presentation), PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 200,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })
    expect(delayed.code).toBe(0)

    const multi = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'multiple-events-per-chunk', PROJECT_LENS_FAKE_FINAL_OUTPUT: JSON.stringify(harness.presentation), PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })
    expect(multi.code).toBe(0)
    await rm(harness.requestDirectory, { recursive: true, force: true, maxRetries: 3 })
    await removeAnalysisWorkspace(harness.workspace.directory, harness.workspace.source)
  })

  it('surfaces provider errors, detects mutations, and supports cancellation and empty output', async () => {
    const harness = await buildHarness()
    const mutatedBefore = await fileManifest(harness.workspace.directory)
    await expect(runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'provider-error', PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })).rejects.toThrow('429')

    const mutation = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'mutation-attempt', PROJECT_LENS_FAKE_FINAL_OUTPUT: JSON.stringify(harness.presentation), PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })
    expect(mutation.code).toBe(0)
    expect(changedFiles(mutatedBefore, await fileManifest(harness.workspace.directory))).toContain('fake-opencode-mutated.txt')

    const aborted = new AbortController()
    const cancellation = runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'hang', PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      signal: aborted.signal,
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })
    setTimeout(() => aborted.abort(), 50)
    await expect(cancellation).rejects.toThrow('cancelled')

    const empty = await runOpenCode(fakeExecutable, [fakeScript, ...buildAnalysisArgs('opencode/deepseek-v4-flash-free', harness.workspace.directory, harness.requestFile)], '', {
      cwd: harness.workspace.directory,
      env: { ...analysisEnvironment(process.env, true), PROJECT_LENS_FAKE_MODE: 'exit-without-output', PROJECT_LENS_FAKE_MODELS: 'opencode/deepseek-v4-flash-free', PROJECT_LENS_EXPECT_CWD: harness.workspace.directory },
      firstResponseTimeoutMs: 500,
      inactivityTimeoutMs: 500,
      totalRunTimeoutMs: 1_000,
      processStartTimeoutMs: 500,
    })
    expect(empty.stdout).toBe('')

    await rm(harness.requestDirectory, { recursive: true, force: true, maxRetries: 3 })
    await removeAnalysisWorkspace(harness.workspace.directory, harness.workspace.source)
  })
})
