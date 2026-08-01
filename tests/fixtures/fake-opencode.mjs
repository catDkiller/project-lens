import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const mode = process.env.PROJECT_LENS_FAKE_MODE ?? 'success'
const availableModels = (process.env.PROJECT_LENS_FAKE_MODELS ?? 'opencode/deepseek-v4-flash-free').split(',').map((value) => value.trim()).filter(Boolean)
const finalOutput = process.env.PROJECT_LENS_FAKE_FINAL_OUTPUT ?? '{"version":"1.0","projectName":"Fake project","sourceType":"Sample","overview":{"whatItIs":"Fake"}}'
const expectedCwd = process.env.PROJECT_LENS_EXPECT_CWD
const requestMarker = 'project-lens-request-v1'
const stateFile = process.env.PROJECT_LENS_FAKE_STATE_FILE

async function readinessFailureIfConfigured() {
  if (!['database-locked-once-then-success', 'database-locked-persistently', 'database-corrupt'].includes(mode)) return
  if (mode === 'database-corrupt') exitError('\u001b[91m\u001b[1mError:\u001b[0m database disk image is malformed')
  let attempts = 0
  if (stateFile) { try { attempts = Number(await readFile(stateFile, 'utf8')) || 0 } catch {} }
  if (mode === 'database-locked-persistently' || attempts === 0) {
    if (stateFile) await writeFile(stateFile, String(attempts + 1), 'utf8')
    exitError('\u001b[91m\u001b[1mError:\u001b[0m database is locked')
  }
}

function exitError(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function parseFlags(values) {
  const flags = {}
  const positional = []
  for (let index = 0; index < values.length; index++) {
    const value = values[index]
    if (!value.startsWith('--')) { positional.push(value); continue }
    const next = values[index + 1]
    if (next && !next.startsWith('--')) { flags[value] = next; index++; continue }
    flags[value] = true
  }
  return { flags, positional }
}

function writeJson(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

async function verifyRun(commandArgs) {
  const { flags, positional } = parseFlags(commandArgs)
  const prompt = positional.join(' ').trim()
  if (!prompt) exitError('OpenCode prompt was empty.')
  const model = typeof flags['--model'] === 'string' ? flags['--model'] : ''
  const requestFile = typeof flags['--file'] === 'string' ? flags['--file'] : ''
  const dir = typeof flags['--dir'] === 'string' ? flags['--dir'] : ''
  const format = typeof flags['--format'] === 'string' ? flags['--format'] : ''
  const agent = typeof flags['--agent'] === 'string' ? flags['--agent'] : ''
  if (!model || !requestFile || !dir || format !== 'json' || agent !== 'plan') exitError('OpenCode arguments were incomplete.')
  if (!availableModels.includes(model)) exitError(`Unknown model: ${model}`)
  if (expectedCwd && process.cwd() !== expectedCwd) exitError(`Unexpected cwd: ${process.cwd()}`)
  const request = JSON.parse(await readFile(requestFile, 'utf8'))
  if (request.schemaMarker !== requestMarker) exitError('Request file schema marker missing.')
  if (request.promptVersion !== '1.0') exitError('Request file prompt version missing.')
  if (typeof request.webResearchPreference !== 'string') exitError('Request file web preference missing.')
  if (!request.deterministicProjectEvidence) exitError('Request file evidence missing.')
  if (mode === 'mutation-attempt') await writeFile(path.join(dir, 'fake-opencode-mutated.txt'), 'mutated', 'utf8')
  if (mode === 'provider-error') exitError('429 rate limit reached')
  if (mode === 'structured-error') { process.stdout.write('{"type":"error","error":{"name":"APIError","data":{"message":"User not found","statusCode":401,"isRetryable":false,"providerID":"openrouter"}}}'); process.exit(1) }
  if (mode === 'hang' || mode === 'cancellation') await new Promise(() => {})
  if (mode === 'delayed-first-response') await new Promise((resolve) => setTimeout(resolve, 40))
  if (mode === 'exit-without-output') return
  if (mode === 'fragmented-ndjson') {
    process.stdout.write('{"type":"queued","message":"Preparing"}\r\n{"type":"analysing","message":"Half')
    await new Promise((resolve) => setTimeout(resolve, 10))
    process.stdout.write('way"}\r\n')
    process.stdout.write('{"type":"web-research","outcome":"used-successfully","source":{"title":"Tools | OpenCode","url":"https://opencode.ai/docs/tools/"}}\r\n')
    writeJson({ text: finalOutput })
    return
  }
  if (mode === 'multiple-events-per-chunk') {
    process.stdout.write('{"type":"queued","message":"Preparing"}\n{"type":"analysing","message":"Streaming"}\n')
    writeJson({ type: 'web-research', outcome: 'attempted-but-unavailable', source: { title: 'Tools | OpenCode', url: 'https://opencode.ai/docs/tools/' } })
    writeJson({ text: finalOutput })
    return
  }
  if (mode === 'malformed-result') {
    writeJson({ text: '{"projectName":"Broken output"}' })
    return
  }
  writeJson({ type: 'queued', message: 'Preparing' })
  writeJson({ type: 'analysing', message: 'Reading project evidence' })
  writeJson({ type: 'web-research', outcome: 'used-successfully', source: { title: 'Tools | OpenCode', url: 'https://opencode.ai/docs/tools/' } })
  writeJson({ text: finalOutput })
}

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

if (args[0] === 'models') {
  await readinessFailureIfConfigured()
  for (const model of availableModels) process.stdout.write(`${model}\n`)
  process.exit(0)
}

if (args[0] === 'auth' && args[1] === 'list') {
  await readinessFailureIfConfigured()
  process.stdout.write('• OpenCode api\n')
  process.exit(0)
}

if (args[0] === 'run') {
  if (process.env.PROJECT_LENS_FAKE_REQUEST_COUNT_FILE) {
    let count = 0
    try { count = Number(await readFile(process.env.PROJECT_LENS_FAKE_REQUEST_COUNT_FILE, 'utf8')) || 0 } catch {}
    await writeFile(process.env.PROJECT_LENS_FAKE_REQUEST_COUNT_FILE, String(count + 1), 'utf8')
  }
  await verifyRun(args.slice(1))
  await new Promise((resolve) => setTimeout(resolve, 0))
  process.exit(0)
}

process.stdout.write('fake opencode\n')
process.exit(0)
