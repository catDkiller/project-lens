import { describe, expect, it } from 'vitest'
import { cleanProjectPath, parseSemanticReportV2, validateSemanticReportV2 } from '../src/knowledge/reportV2'

const overview = `<!-- project-lens:overview:v2 -->
# Image pipeline
> Turns input images into a combined output image.

## At a glance
- Project type: Python pipeline

## What it does
Processes images.

## How it works
1. Load [main.py](../source/main.py)

## Start here
1. Read \`main.py\`.

## Project areas
### Processing
Owns the pipeline.`

describe('semantic report V2', () => {
  it('extracts the stable Overview sections without requiring optional content', () => {
    expect(parseSemanticReportV2(overview, 'overview')).toMatchObject({ title: 'Image pipeline', sections: expect.arrayContaining([expect.objectContaining({ id: 'how-it-works' })]) })
    expect(validateSemanticReportV2(overview, 'overview')).toEqual([])
  })
  it('keeps V1 artifacts on the fallback path and strips internal snapshot prefixes', () => {
    expect(parseSemanticReportV2('# Old report', 'overview')).toBeNull()
    expect(cleanProjectPath('../source/Face Averaging/align.py')).toBe('Face Averaging/align.py')
  })
  it('returns precise missing-section diagnostics', () => {
    expect(validateSemanticReportV2('<!-- project-lens:overview:v2 -->\n# Missing\n> Intro', 'overview')).toContain('overview-v2-missing-project-areas')
  })
  it('accepts a complete guide that starts its explanation at the first required section', () => {
    const guide = `<!-- project-lens:complete-guide:v2 -->
# Image pipeline Complete Guide
## Mental model
The project processes images.
## Architecture or execution flow
1. Load input.
## Project areas
Processing.
## File walkthrough
\`main.py\`
## Suggested learning order
1. Read the entrypoint.`
    expect(validateSemanticReportV2(guide, 'complete-guide')).toEqual([])
  })
})
