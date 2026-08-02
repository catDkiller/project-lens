import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { buildPresentationKnowledgeBase } from './codexInsights'
import { parseSemanticReportV2, type ReportMode } from './reportV2'
import type { ProjectKnowledgeBase } from './types'
import type { PresentationKnowledgeBase } from './presentationTypes'
import { MAX_PRESENTATION_TEXT_LENGTH } from './presentationValidation'

/** The single limit for plain-text UI summaries. Full Markdown is not bounded by this value. */
export const REPORT_SUMMARY_MAX_LENGTH = MAX_PRESENTATION_TEXT_LENGTH
export const REPORT_SCHEMA_VERSION = 2
export const REPORT_BUILDER_VERSION = 2

type MarkdownNode = { type?: string; value?: string; children?: MarkdownNode[] }
const text = (node: MarkdownNode): string => node.type === 'html' ? '' : [node.value ?? '', ...(node.children ?? []).map(text)].join('')
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

export function extractReportSummary(markdown: string, mode: ReportMode, maxLength = REPORT_SUMMARY_MAX_LENGTH): string {
  const tree = unified().use(remarkParse).parse(markdown) as MarkdownNode
  const candidates = (tree.children ?? []).filter((node) => node.type === 'blockquote' || node.type === 'paragraph')
  const semantic = parseSemanticReportV2(markdown, mode)
  const preferred = candidates.find((node) => node.type === 'blockquote') ?? candidates[0]
  const fallback = semantic?.sections.find((section) => normalize(section.markdown))?.markdown ?? ''
  const value = normalize(text(preferred ?? { value: fallback }))
  if (!value) return ''
  if (value.length <= maxLength) return value
  const boundary = value.lastIndexOf(' ', maxLength - 1)
  return `${value.slice(0, boundary > 0 ? boundary : maxLength).trim()}…`
}

export function buildReportFromValidatedArtifacts(raw: ProjectKnowledgeBase, artifacts: { overview: string; completeGuide: string }): PresentationKnowledgeBase {
  const base = buildPresentationKnowledgeBase(raw)
  const overviewSummary = extractReportSummary(artifacts.overview, 'overview')
  const guideSummary = extractReportSummary(artifacts.completeGuide, 'complete-guide')
  return { ...base, overviewMarkdown: artifacts.overview, completeGuideMarkdown: artifacts.completeGuide, shortSummary: overviewSummary, overview: { ...base.overview, whatItIs: overviewSummary }, sections: [{ id: 'complete-guide-artifact', title: 'Complete Guide', shortExplanation: guideSummary }, ...(base.sections ?? [])] }
}
