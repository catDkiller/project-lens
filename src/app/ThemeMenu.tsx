export type Appearance = 'light' | 'dark'
export type Accent = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'

interface ThemeMenuProps { appearance: Appearance; accent: Accent; onAppearance: (value: Appearance) => void; onAccent: (value: Accent) => void }

export function ThemeMenu({ appearance, accent, onAppearance, onAccent }: ThemeMenuProps) {
  return <details className="theme-menu"><summary aria-label="Appearance settings">Theme</summary><div className="theme-popover"><p>Appearance</p>{(['light', 'dark'] as Appearance[]).map((item) => <button aria-pressed={appearance === item} key={item} type="button" onClick={() => onAppearance(item)}>{item}</button>)}<p>Accent</p>{(['blue', 'violet', 'emerald', 'amber', 'rose'] as Accent[]).map((item) => <button aria-pressed={accent === item} key={item} type="button" onClick={() => onAccent(item)}><span className={`swatch ${item}`} />{item}</button>)}</div></details>
}
