import { mkdir, writeFile } from 'node:fs/promises'

process.stdout.write(`${JSON.stringify({ type: 'thread.started', thread_id: 'fixture-thread' })}\n`)
process.stdout.write(`${JSON.stringify({ type: 'turn.started' })}\n`)
await new Promise((resolve) => setTimeout(resolve, 10))
await mkdir('artifacts', { recursive: true })
await writeFile('artifacts/overview.md', '# Controlled overview\n\n`source/src/main.ts`\n', 'utf8')
await writeFile('artifacts/complete-guide.md', '# Controlled guide\n\nRead `source/src/main.ts`.\n', 'utf8')
process.stdout.write(`${JSON.stringify({ type: 'item.completed', item: { type: 'file_change', path: 'artifacts/overview.md' } })}\n`)
