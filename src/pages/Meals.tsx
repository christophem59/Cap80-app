import { useState } from 'react'
import { JournalTab } from './meals/JournalTab'

type Tab = 'journal' | 'propositions' | 'courses'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'propositions', label: 'Propositions' },
  { id: 'courses', label: 'Courses' },
]

export function Meals() {
  const [tab, setTab] = useState<Tab>('journal')
  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Repas</h1>

      <div
        role="tablist"
        aria-label="Sous-sections des repas"
        className="mb-4 flex rounded-lg bg-[var(--surface-2)] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 rounded-md py-1.5 text-sm font-medium',
              tab === t.id
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'journal' && <JournalTab />}
      {tab !== 'journal' && (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Propositions (semaine type), recettes, liste de courses et batch cooking arrivent
          au lot 6b.
        </p>
      )}
    </section>
  )
}
