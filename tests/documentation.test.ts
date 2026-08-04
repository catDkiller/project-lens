import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

describe('public installation documentation', () => {
  it('links the verified installation resources and public URLs', async () => {
    const readme = await readFile(path.join(root, 'README.md'), 'utf8')
    expect(readme).toContain('[INSTALL.md](INSTALL.md)')
    expect(readme).toContain('docs/CODEX_INSTALL_PROJECT_LENS.md')
    expect(readme).toContain('https://github.com/catDkiller/project-lens')
    expect(readme).toContain('https://website-seven-beryl-14.vercel.app/')
    expect(readme).toContain('https://website-seven-beryl-14.vercel.app/report/')
    expect(readme).toContain('https://youtu.be/lNfbdZfcho0')
  })

  it('keeps installation claims aligned with the repository contract', async () => {
    const install = await readFile(path.join(root, 'INSTALL.md'), 'utf8')
    const prompt = await readFile(path.join(root, 'docs', 'CODEX_INSTALL_PROJECT_LENS.md'), 'utf8')
    const docs = install + '\n' + prompt
    expect(docs).toContain('git clone https://github.com/catDkiller/project-lens.git')
    expect(docs).toContain('setup-project-lens.bat')
    expect(docs).toContain('doctor-project-lens.bat')
    expect(docs).toContain('start-project-lens.bat')
    expect(docs).toContain('stop-project-lens.bat')
    expect(docs).toContain('^20.19.0 || >=22.12.0')
    expect(docs).not.toContain('D:\\hackathon-project')
    expect(docs).not.toContain('open-design-ui-prototype')
    expect(docs).toContain('Do not paste an API key')
    expect(docs).toContain('never use or invent `automatic`')
  })
})
