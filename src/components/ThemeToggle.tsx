import { setThemePref, useThemePref } from '../theme'
import { SunIcon, MoonIcon } from './icons'

// Bascule directe clair ↔ sombre (un seul tap, pas de mode « système »).
export function ThemeToggle() {
  const pref = useThemePref()
  const next = pref === 'light' ? 'dark' : 'light'
  const Icon = pref === 'light' ? SunIcon : MoonIcon
  const label = pref === 'light' ? 'Passer en thème sombre' : 'Passer en thème clair'
  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <Icon width={22} height={22} />
    </button>
  )
}
