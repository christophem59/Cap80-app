import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { SettingsIcon } from './icons'

export function Header() {
  return (
    <header
      className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link to="/" aria-label="Cap80 — accueil" className="flex items-center">
          <img
            src={`${import.meta.env.BASE_URL}logo-cap80.png`}
            alt="Cap80"
            className="h-8 w-auto rounded-md"
          />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            to="/reglages"
            aria-label="Réglages"
            title="Réglages"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <SettingsIcon width={22} height={22} />
          </Link>
        </div>
      </div>
    </header>
  )
}
