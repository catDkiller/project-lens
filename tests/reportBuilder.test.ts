import { describe, expect, it } from 'vitest'
import { buildReportFromValidatedArtifacts, extractReportSummary, REPORT_SUMMARY_MAX_LENGTH } from '../src/knowledge/reportBuilder'
import { validatePresentationKnowledgeBase } from '../src/knowledge/presentationValidation'
import type { ProjectKnowledgeBase } from '../src/knowledge/types'

const overview = `<!-- project-lens:overview:v2 -->
# Sample
> A concise **introduction** with [a link](https://example.test) and \`code\`.

## At a glance
Text
## What it does
Text
## How it works
Text
## Start here
Text
## Project areas
Text`
const guide = `<!-- project-lens:complete-guide:v2 -->
# Complete Guide
## Mental model
${'A long explanation. '.repeat(800)}
## Architecture or execution flow
Text
## Project areas
Text
## File walkthrough
Text
## Suggested learning order
Text`
const raw: ProjectKnowledgeBase = { id: 'sample', name: 'Sample', sourceType: 'sample', importantFiles: [] }

describe('report builder', () => {
  it('derives bounded plain summaries rather than assigning full Markdown to legacy fields', () => {
    const report = buildReportFromValidatedArtifacts(raw, { overview, completeGuide: guide })
    expect(report.overviewMarkdown).toBe(overview)
    expect(report.completeGuideMarkdown).toBe(guide)
    expect(report.shortSummary).toBe('A concise introduction with a link and code.')
    expect(report.sections?.[0].shortExplanation).toHaveLength(REPORT_SUMMARY_MAX_LENGTH)
    expect(report.sections?.[0].shortExplanation?.endsWith('…')).toBe(true)
    expect(validatePresentationKnowledgeBase(report, raw)).toEqual([])
  })

  it('uses the first meaningful section when a complete guide has no introduction', () => {
    expect(extractReportSummary(guide, 'complete-guide')).toMatch(/^A long explanation/)
  })
})
