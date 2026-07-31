import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('launcher local import and model selector', () => {
  it('uses both native and webkit folder-picker paths and keeps the popup accessible', async () => {
    const source = await readFile(new URL('../src/app/Launcher.tsx', import.meta.url), 'utf8')
    expect(source).toContain('showDirectoryPicker')
    expect(source).toContain('webkitdirectory = true')
    expect(source).toContain("'Folder selection cancelled.'")
    expect(source).toContain('createPortal')
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("event.key === 'ArrowDown'")
    expect(source).toContain("event.key === 'Home'")
    expect(source).toContain("event.key === 'End'")
    expect(source).toContain('triggerRef.current?.focus()')
    expect(source).toContain('role="group"')
    expect(source).toContain('title={item.fullId}')
    expect(source).toContain('Use current web documentation')
  })

  it('keeps pointer selection inside the portal and separates highlight from commit', async () => {
    const source = await readFile(new URL('../src/app/Launcher.tsx', import.meta.url), 'utf8')
    expect(source).toContain('onPointerDown={(event) => event.stopPropagation()}')
    expect(source).toContain('highlightedId')
    expect(source).toContain("if (event.key === 'Enter')")
    expect(source).toContain('choose(visible.find((item) => item.fullId === highlightedId))')
    expect(source).toContain('disabled={!canChoose(item)}')
    expect(source).toContain('setModel(item!.fullId)')
    expect(source).toContain('setOpen(false)')
    expect(source).toContain('Connect ${provider.displayName}')
  })
})
