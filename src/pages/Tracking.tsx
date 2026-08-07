import { useState } from 'react'
import { PoidsTab } from './tracking/PoidsTab'
import { MensurationsTab } from './tracking/MensurationsTab'
import { PhotosTab } from './tracking/PhotosTab'

type Tab = 'poids' | 'mensurations' | 'photos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'poids', label: 'Poids' },
  { id: 'mensurations', label: 'Mensurations' },
  { id: 'photos', label: 'Photos' },
]

export function Tracking() {
  const [tab, setTab] = useState<Tab>('poids')
  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Suivi</h1>

      <div
        role="tablist"
        aria-label="Sous-sections du suivi"
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

      {tab === 'poids' && <PoidsTab />}
      {tab === 'mensurations' && <MensurationsTab />}
      {tab === 'photos' && <PhotosTab />}
    </section>
  )
}
