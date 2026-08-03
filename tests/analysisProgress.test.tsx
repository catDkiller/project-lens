import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AnalysisProgress } from '../src/app/AnalysisProgress'
import type { AnalysisEventDto, AnalysisRunStatusDto } from '../src/local-api/contracts'

const status: AnalysisRunStatusDto = { runId: 'run-1', projectId: 'project-1', agentId: 'codex', state: 'running', createdAt: new Date(Date.now() - 120_000).toISOString(), startedAt: new Date(Date.now() - 120_000).toISOString(), childPid: 1234, lastAnyEventAt: new Date(Date.now() - 2_000).toISOString(), lastGenuineAgentEventAt: new Date(Date.now() - 95_000).toISOString(), cancellationRequested: false, events: [] }
const event: AnalysisEventDto = { id: 'event-1', runId: 'run-1', sequence: 1, type: 'status', stage: 'codex-analysis', status: 'active', message: 'Inspecting package.json', timestamp: new Date().toISOString(), metadata: { includedFiles: 286, processedBytes: 3_400_000, selectedModel: 'gpt-5.4-mini' }, process: { alive: true, pidAvailable: true } }

describe('honest analysis progress', () => {
  it('shows the current stage, scope, process health and quiet warning without fake percentage', () => {
    const markup = renderToStaticMarkup(<AnalysisProgress projectName="Large project" events={[event]} startedAt={Date.now() - 120_000} status={status} failed={undefined} onRetry={vi.fn()} onReturn={vi.fn()} onCancel={vi.fn()} />)
    expect(markup).toContain('Analysing with Codex')
    expect(markup).toContain('Process status: Running')
    expect(markup).toContain('Analysis scope: 286 files')
    expect(markup).toContain('No new Codex activity for 2 minutes')
    expect(markup).not.toContain('67%')
    expect(markup).toContain('Inspecting package.json')
  })

  it('keeps Recent activity populated immediately after run creation', () => {
    const queued: AnalysisEventDto = { id: 'event-queued', runId: 'run-1', sequence: 1, type: 'queued', stage: 'preparing', status: 'active', message: 'Run created. Preparing local analysis.' }
    const markup = renderToStaticMarkup(<AnalysisProgress projectName="Project" events={[queued]} startedAt={Date.now()} status={{ ...status, state: 'preparing-project', childPid: undefined, lastGenuineAgentEventAt: undefined }} onRetry={vi.fn()} onReturn={vi.fn()} onCancel={vi.fn()} />)
    expect(markup).toContain('Run created. Preparing local analysis.')
    expect(markup).toContain('Recent activity (1)')
  })
})
