const base = process.env.PROJECT_LENS_DAEMON_URL ?? 'http://127.0.0.1:8787'

async function api(path: string, token: string, init: RequestInit = {}) { return fetch(`${base}${path}`, { ...init, headers: { ...init.headers, 'x-project-lens-token': token } }) }

async function main() {
  const [, , command, folder, ...rest] = process.argv
  if (command !== 'analyze' || !folder) throw new Error('Usage: project-lens analyze <folder> [--model <model>] [--json]')
  const health = await fetch(`${base}/api/runtime/health`).then((response) => response.json() as Promise<{ token: string }>)
  const prepared = await api('/api/source/local-path', health.token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: folder }) })
  if (!prepared.ok) throw new Error((await prepared.json() as { error?: string }).error ?? 'Could not prepare folder.')
  const source = await prepared.json() as { name: string; canonicalPath: string; files: { path: string; content: string }[]; projectType: string }
  const modelIndex = rest.indexOf('--model'); const model = modelIndex >= 0 ? rest[modelIndex + 1] : undefined; const json = rest.includes('--json')
  const started = await api('/api/runs', health.token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...source, sourcePath: source.canonicalPath, model }) })
  if (!started.ok) throw new Error((await started.json() as { error?: string }).error ?? 'Could not start analysis.')
  const { runId } = await started.json() as { runId: string }
  const stream = await api(`/api/runs/${runId}/events`, health.token)
  if (!stream.body) throw new Error('Could not open activity stream.')
  const reader = stream.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  for (;;) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const blocks = buffer.split('\n\n'); buffer = blocks.pop() ?? ''; for (const block of blocks) { const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6); if (!data) continue; const event = JSON.parse(data) as { type: string; message?: string }; if (json) process.stdout.write(`${JSON.stringify(event)}\n`); else process.stdout.write(`${event.type}: ${event.message ?? ''}\n`) } }
  const report = await api(`/api/runs/${runId}/report`, health.token); if (report.ok) process.stdout.write(`${json ? JSON.stringify(await report.json()) : `Artifacts: .project-lens/runs/${runId}/artifacts`}\n`)
}
void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = 1 })
