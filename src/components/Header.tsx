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
        <Link to="/" className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: 'var(--accent)' }}
            aria-hidden="true"
          >
            <span className="block h-3 w-3 rounded-full border-[3px] border-white" />
          </span>
          <span className="text-lg font-semibold">Cap80</span>
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
