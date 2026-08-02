import { describe, expect, it } from 'vitest'
import { parseCodexJson, sanitizedCodexEnvironment } from '../src/local-api/codex'

describe('Codex boundary', () => {
  it('removes API-key environment variables before SDK construction', () => {
    const previousApi = process.env.OPENAI_API_KEY
    const previousCodex = process.env.CODEX_API_KEY
    process.env.OPENAI_API_KEY = 'secret'
    process.env.CODEX_API_KEY = 'secret'
    const environment = sanitizedCodexEnvironment()
    expect(environment.OPENAI_API_KEY).toBeUndefined()
    expect(environment.CODEX_API_KEY).toBeUndefined()
    if (previousApi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousApi
    if (previousCodex === undefined) delete process.env.CODEX_API_KEY; else process.env.CODEX_API_KEY = previousCodex
  })

  it('accepts direct, fenced and surrounded JSON', () => {
    expect(parseCodexJson('{"ok":true}')).toEqual({ ok: true })
    expect(parseCodexJson('```json\n{"ok":true}\n```')).toEqual({ ok: true })
    expect(parseCodexJson('Here is the result:\n{"ok":true}')).toEqual({ ok: true })
  })
})
