import { setThemePref, useThemePref } from '../theme'
import type { ThemePref } from '../theme'
import { SunIcon, MoonIcon, AutoIcon } from './icons'

// Cycle système → clair → sombre → système. Icône + libellé accessible.
const NEXT: Record<ThemePref, ThemePref> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}
const LABEL: Record<ThemePref, string> = {
  system: 'Thème : système',
  light: 'Thème : clair',
  dark: 'Thème : sombre',
}

export function ThemeToggle() {
  const pref = useThemePref()
  const Icon = pref === 'light' ? SunIcon : pref === 'dark' ? MoonIcon : AutoIcon
  return (
    <button
      type="button"
      onClick={() => setThemePref(NEXT[pref])}
      aria-label={LABEL[pref]}
      title={LABEL[pref]}
      className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <Icon width={22} height={22} />
    </button>
  )
}
