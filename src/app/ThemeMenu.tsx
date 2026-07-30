export type Appearance = 'light' | 'dark'
export type Accent = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'

interface ThemeMenuProps { appearance: Appearance; accent: Accent; onAppearance: (value: Appearance) => void; onAccent: (value: Accent) => void }

export function ThemeMenu({ appearance, accent, onAppearance, onAccent }: ThemeMenuProps) {
  const scope = useRef<HTMLDetailsElement>(null)
  useDisclosureMotion(scope)
  return (
    <details className="theme-menu" ref={scope}>
      <summary aria-label="Appearance and accent settings" className="theme-toggle">
        <span className="theme-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5v2.1M8 12.4v2.1M4.3 4.3 5.8 5.8M10.2 10.2l1.5 1.5M1.5 8h2.1M12.4 8h2.1M4.3 11.7l1.5-1.5M10.2 5.8l1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </summary>
      <div className="theme-popover" role="group" aria-label="Theme settings">
        <p>Appearance</p>
        {(['light', 'dark'] as Appearance[]).map((item) => <button aria-pressed={appearance === item} key={item} type="button" onClick={() => onAppearance(item)}>{item}</button>)}
        <p>Accent</p>
        {(['blue', 'violet', 'emerald', 'amber', 'rose'] as Accent[]).map((item) => <button aria-pressed={accent === item} key={item} type="button" onClick={() => onAccent(item)}><span className={`swatch ${item}`} />{item}</button>)}
      </div>
    </details>
  )
}
import { useRef } from 'react'
import { useDisclosureMotion } from '../motion/useDisclosureMotion'
