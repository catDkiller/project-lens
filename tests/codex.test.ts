import { describe, expect, it } from 'vitest'
import { codexArgs, parseCodexJson } from '../src/local-api/codex'

describe('Codex execution contract', () => {
  it('uses the verified model override and keeps automatic model-free', () => {
    expect(codexArgs('C:/tmp/lens', 'gpt-5.4-mini', 'C:/tmp/schema.json', 'C:/tmp/output.json')).toContain('--model')
    expect(codexArgs('C:/tmp/lens', 'gpt-5.4-mini', 'C:/tmp/schema.json', 'C:/tmp/output.json')).toContain('gpt-5.4-mini')
    expect(codexArgs('C:/tmp/lens', undefined, 'C:/tmp/schema.json', 'C:/tmp/output.json')).not.toContain('--model')
    expect(codexArgs('C:/tmp/lens', 'gpt-5.4', 'C:/tmp/schema.json', 'C:/tmp/output.json')).toEqual(expect.arrayContaining(['--output-schema', 'C:/tmp/schema.json', '--output-last-message', 'C:/tmp/output.json']))
  })

  it('accepts JSON returned directly or in a markdown fence', () => {
    expect(parseCodexJson('{"ok":true}')).toEqual({ ok: true })
    expect(parseCodexJson('```json\n{"ok":true}\n```')).toEqual({ ok: true })
    expect(parseCodexJson('Here is the result:\n{"ok":true}')).toEqual({ ok: true })
  })
})
