import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

describe('fresh-install launchers', () => {
  it('uses a repository-relative, space-safe Windows entry point', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'project-lens-setup.ps1'), 'utf8')
    const start = await readFile(path.join(root, 'scripts', 'project-lens-start.ps1'), 'utf8')
    expect(setup).toContain('$Root = Split-Path -Parent $PSScriptRoot')
    expect(start).toContain('$Root = Split-Path -Parent $PSScriptRoot')
    expect(start).toContain('Wait-Http')
    expect(start).toContain('Start-Process \'http://127.0.0.1:5173\'')
  })

  it('fails clearly for missing prerequisites and never embeds credentials', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'project-lens-setup.ps1'), 'utf8')
    const doctor = await readFile(path.join(root, 'scripts', 'doctor-project-lens.ps1'), 'utf8')
    expect(setup).toContain('OpenAI Codex CLI was not found')
    expect(setup).toContain('codex login')
    expect(setup).not.toMatch(/OPENAI_API_KEY\s*=/)
    expect(setup).not.toMatch(/CODEX_API_KEY\s*=/)
    expect(doctor).toContain('NOT READY')
    expect(doctor).toContain('Codex authentication')
  })

  it('tracks only launcher-owned processes and handles repeated stops', async () => {
    const stop = await readFile(path.join(root, 'scripts', 'project-lens-stop.ps1'), 'utf8')
    const start = await readFile(path.join(root, 'scripts', 'project-lens-start.ps1'), 'utf8')
    expect(stop).toContain('processes.json')
    expect(stop).toContain('ParentProcessId')
    expect(stop).not.toContain('Get-Process node | Stop-Process')
    expect(start).toContain('Project Lens is already running')
    expect(start).toContain('port 8787 is occupied')
    expect(start).toContain('port 5173 is occupied')
  })
})
