
export type ReportMode = 'overview' | 'complete-guide'
export type SemanticReport = { mode: ReportMode; title: string; introduction: string; sections: Array<{ id: string; title: string; markdown: string }> }

const markers: Record<ReportMode, string> = { overview: '<!-- project-lens:overview:v2 -->', 'complete-guide': '<!-- project-lens:complete-guide:v2 -->' }
const required: Record<ReportMode, string[]> = { overview: ['at a glance', 'what it does', 'how it works', 'start here', 'project areas'], 'complete-guide': ['mental model', 'architecture or execution flow', 'project areas', 'file walkthrough', 'suggested learning order'] }
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
export const isSemanticReportV2 = (text: string, mode: ReportMode) => text.trimStart().startsWith(markers[mode])

export function parseSemanticReportV2(text: string, mode: ReportMode): SemanticReport | null {
  if (!isSemanticReportV2(text, mode)) return null
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); const h1 = lines.findIndex((line) => /^#\s+/.test(line))
  if (h1 < 0) return null
  const title = lines[h1].replace(/^#\s+/, '').trim(); const starts = lines.map((line, index) => /^##\s+/.test(line) ? index : -1).filter((index) => index >= 0)
  const introduction = lines.slice(h1 + 1, starts[0] ?? lines.length).join('\n').trim().replace(/^>\s?/, '')
  const sections = starts.map((start, index) => { const sectionTitle = lines[start].replace(/^##\s+/, '').trim(); return { id: slug(sectionTitle), title: sectionTitle, markdown: lines.slice(start + 1, starts[index + 1] ?? lines.length).join('\n').trim() } })
  return { mode, title, introduction, sections }
}

export function validateSemanticReportV2(text: string, mode: ReportMode): string[] {
  if (!isSemanticReportV2(text, mode)) return []
  const report = parseSemanticReportV2(text, mode); const issues: string[] = []
  if (!report?.title) issues.push(`${mode}-v2-missing-h1`)
  if (!report?.introduction) issues.push(`${mode}-v2-missing-introduction`)
  const headings = new Set(report?.sections.map((section) => section.id) ?? [])
  for (const name of required[mode]) if (!headings.has(slug(name))) issues.push(`${mode}-v2-missing-${slug(name)}`)
  return issues
}

export function cleanProjectPath(value: string) { return value.replaceAll('\\', '/').replace(/^\.\.\/source\//i, '').replace(/^\.\/?source\//i, '') }
