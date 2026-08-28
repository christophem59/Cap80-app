import { useState } from 'react'
import { useWeights, deleteWeight } from '../../repo/weights'
import { useProfile } from '../../repo/profile'
import { WeightChart } from '../../components/WeightChart'
import type { Period } from '../../components/WeightChart'
import { WeightEntryForm } from '../../components/WeightEntryForm'
import { weeklyAverages, lossRate } from '../../domain/weight'
import type { WeightEntry, WeightFlag } from '../../domain/types'

const FLAG_SHORT: Record<WeightFlag, string> = {
  repas_sale: 'salé',
  alcool: 'alcool',
  mauvais_sommeil: 'sommeil',
  seance_veille: 'séance',
  constipation: 'constip.',
  maladie: 'maladie',
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
  { value: 'all', label: 'Tout' },
]

function fmtKg(n: number) {
  return n.toFixed(1).replace('.', ',')
}

function verdict(perte: number | null): { text: string; color: string } {
  if (perte === null)
    return { text: 'Pas assez de données (3 semaines complètes)', color: 'var(--text-muted)' }
  const kg = `${fmtKg(Math.abs(perte))} kg/sem`
  if (perte > 0.9) return { text: `${kg} — trop rapide`, color: 'var(--warn)' }
  if (perte >= 0.4) return { text: `${kg} — rythme idéal`, color: 'var(--ok)' }
  if (perte >= 0.3) return { text: `${kg} — un peu lent`, color: 'var(--warn)' }
  if (perte > 0) return { text: `${kg} — trop lent`, color: 'var(--warn)' }
  return { text: `${fmtKg(-perte)} kg/sem — plateau ou reprise`, color: 'var(--warn)' }
}

export function PoidsTab() {
  const weights = useWeights()
  const profile = useProfile()
  // 30 jours par défaut : la fenêtre où la moyenne mobile se lit vraiment. Sur 90 j,
  // les variations du jour s'écrasent et la courbe paraît plate.
  const [period, setPeriod] = useState<Period>(30)
  const [showEntry, setShowEntry] = useState(false)

  const weekly = weeklyAverages(weights, profile.startDate, 1)
  const rate = lossRate(weekly, 3) // négatif = perte
  const v = verdict(rate === null ? null : -rate)

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <WeightChart weights={weights} profile={profile} period={period} />
        <div className="mt-2 flex justify-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                'rounded-full px-3 py-1 text-xs',
                period === p.value
                  ? 'text-white'
                  : 'border border-[var(--border)] text-[var(--text-muted)]',
              ].join(' ')}
              style={period === p.value ? { background: 'var(--accent)' } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
          Vitesse de perte (3 dernières semaines)
        </p>
        <p className="mt-1 font-medium" style={{ color: v.color }}>
          {v.text}
        </p>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pesées</h2>
          <button
            type="button"
            onClick={() => setShowEntry((s) => !s)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            {showEntry ? 'Fermer' : 'Peser'}
          </button>
        </div>
        {showEntry && (
          <div className="mt-3">
            <WeightEntryForm onSaved={() => setShowEntry(false)} />
          </div>
        )}
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {weights.length === 0 && (
            <li className="py-3 text-sm text-[var(--text-muted)]">Aucune pesée enregistrée.</li>
          )}
          {weights.map((w: WeightEntry) => (
            <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 tabular-nums text-[var(--text-muted)]">
                {w.date.slice(8)}/{w.date.slice(5, 7)}
              </span>
              <span className="font-medium tabular-nums">{fmtKg(w.weightKg)} kg</span>
              {w.flags && w.flags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {w.flags.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                    >
                      {FLAG_SHORT[f]}
                    </span>
                  ))}
                </span>
              )}
              <button
                type="button"
                onClick={() => void deleteWeight(w.id)}
                className="ml-auto text-xs text-[var(--text-muted)] underline"
              >
                suppr.
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
