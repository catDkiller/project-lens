import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface QuarantinedProjectControl { path: string; kind: 'instruction' | 'configuration' | 'plugin-or-rule'; content: string; truncated: boolean }
const MAX_FILE_BYTES = 32_768
const MAX_TOTAL_BYTES = 128_000
const exactFiles = new Set(['agents.md', 'claude.md', 'context.md', 'copilot-instructions.md', '.mcp.json', '.cursorrules', '.clinerules', '.windsurfrules'])
const controlDirectories = new Set(['.claude', '.cursor', '.agents', '.windsurf'])

function classify(relative: string): QuarantinedProjectControl['kind'] | undefined {
  const parts = relative.replaceAll('\\', '/').split('/'); const name = parts.at(-1)!.toLowerCase()
  if (exactFiles.has(name)) return name.endsWith('.json') || name.endsWith('.jsonc') ? 'configuration' : 'instruction'
  if (parts.some((part) => controlDirectories.has(part.toLowerCase()))) return 'plugin-or-rule'
  if (/^(agent|plugin|rule)[-_].*\.(json|jsonc|md|yaml|yml|toml)$/i.test(name)) return 'plugin-or-rule'
  return undefined
}

export async function quarantineProjectControls(root: string, evidenceRoot: string) {
  const controls: QuarantinedProjectControl[] = []; let total = 0
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name); const relative = path.relative(root, absolute).replaceAll('\\', '/'); const kind = classify(relative)
      if (entry.isDirectory() && controlDirectories.has(entry.name.toLowerCase())) {
        await visit(absolute); await rm(absolute, { recursive: true, force: true }); continue
      }
      if (entry.isDirectory()) { await visit(absolute); continue }
      if (!entry.isFile() || !kind) continue
      const bytes = await readFile(absolute); const remaining = Math.max(0, MAX_TOTAL_BYTES - total); const allowed = Math.min(MAX_FILE_BYTES, remaining); const content = bytes.subarray(0, allowed).toString('utf8'); total += Buffer.byteLength(content)
      controls.push({ path: relative, kind, content, truncated: bytes.length > allowed }); await rm(absolute, { force: true })
    }
  }
  await visit(root)
  await writeFile(path.join(evidenceRoot, 'quarantined-project-controls.json'), JSON.stringify({ version: '1.0', controls }, null, 2), 'utf8')
  return controls
}
