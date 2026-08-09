import { setThemePref, useThemePref } from '../theme'
import type { ThemePref } from '../theme'
import { RepoConfigCard } from '../components/RepoConfigCard'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Settings() {
  const pref = useThemePref()
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <Card title="Apparence">
        <div
          role="radiogroup"
          aria-label="Thème"
          className="flex gap-2"
        >
          {THEME_OPTIONS.map((o) => {
            const active = pref === o.value
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemePref(o.value)}
                className={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium',
                  active
                    ? 'border-transparent text-white'
                    : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]',
                ].join(' ')}
                style={active ? { background: 'var(--accent)' } : undefined}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </Card>

      <RepoConfigCard />

      <Card title="À propos">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-[var(--text-muted)]">Version</dt>
          <dd className="text-right">{__APP_VERSION__}</dd>
          <dt className="text-[var(--text-muted)]">Commit déployé</dt>
          <dd className="text-right font-mono">{__COMMIT_HASH__}</dd>
        </dl>
      </Card>
    </section>
  )
}
