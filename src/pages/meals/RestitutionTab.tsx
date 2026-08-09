import { useMemo } from 'react'
import type { SnackTrigger } from '../../domain/types'
import { todayLocal, addDays } from '../../domain/dates'
import { snackHeatmap, dissipationRate, peakWindow } from '../../domain/snack'
import type { Weekday } from '../../domain/snack'
import type { SnackLog } from '../../domain/types'
import { useSnacks, deleteSnack } from '../../repo/snacks'
import { useWorkouts } from '../../repo/workouts'

const OUTCOME_LABELS: Record<NonNullable<SnackLog['outcome']>, string> = {
  mange: 'mangé',
  'zone-libre': 'zone libre',
  passe: 'passé',
}

// §ton : suppression en un geste, sans confirmation moralisatrice.
function RecentsList({ snacks }: { snacks: SnackLog[] }) {
  const recents = snacks.filter((s) => !s.deletedAt).slice(0, 8)
  if (recents.length === 0) return null
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Épisodes récents
      </h2>
      <ul className="divide-y divide-[var(--border)]">
        {recents.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="w-24 shrink-0 tabular-nums text-[var(--text-muted)]">
              {s.date.slice(8)}/{s.date.slice(5, 7)} · {s.time}
            </span>
            <span className="flex-1">
              {TRIGGER_LABELS[s.trigger]}
              {s.outcome ? (
                <span className="text-[var(--text-muted)]"> · {OUTCOME_LABELS[s.outcome]}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => void deleteSnack(s)}
              aria-label="Supprimer cet épisode"
              className="text-xs text-[var(--text-muted)] underline"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const TRIGGER_LABELS: Record<SnackTrigger, string> = {
  ennui: 'Ennui',
  faim: 'Faim',
  stress: 'Stress',
  fatigue: 'Fatigue',
  social: 'Social',
  habitude: 'Habitude',
  envie: 'Envie',
}
const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function daysBetween(a: string, b: string): number {
  const n = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  }
  return n(b) - n(a)
}
// Rampe séquentielle une seule teinte (accent), pas de couleur d'alerte (§7.10 / ton).
function cellBg(count: number, max: number): string {
  if (count === 0) return 'transparent'
  const a = 0.15 + 0.85 * (count / max)
  return `rgba(37, 99, 235, ${a.toFixed(3)})`
}
function pct(x: number): string {
  return `${Math.round(x * 100)} %`
}

export function RestitutionTab() {
  const snacks = useSnacks()
  const workouts = useWorkouts()
  const today = todayLocal()

  const earliest = snacks.length ? snacks[snacks.length - 1].date : today
  const daysOfData = snacks.length ? daysBetween(earliest, today) + 1 : 0

  const heatmap = useMemo(() => snackHeatmap(snacks, 8, today), [snacks, today])
  const maxCell = useMemo(() => {
    let m = 0
    for (const row of Object.values(heatmap)) for (const v of Object.values(row)) m = Math.max(m, v)
    return m
  }, [heatmap])
  const peak = useMemo(() => peakWindow(snacks), [snacks])

  const triggerCounts = useMemo(() => {
    const c = new Map<SnackTrigger, number>()
    for (const s of snacks) if (!s.deletedAt) c.set(s.trigger, (c.get(s.trigger) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [snacks])
  const triggerMax = triggerCounts[0]?.[1] ?? 1

  const dissip = dissipationRate(snacks, addDays(today, -27), today)
  const weekly = useMemo(
    () =>
      [3, 2, 1, 0].map((w) =>
        dissipationRate(snacks, addDays(today, -(w * 7 + 6)), addDays(today, -w * 7)),
      ),
    [snacks, today],
  )

  // Croisement séances : part des épisodes les jours sans séance.
  const crossing = useMemo(() => {
    const workoutDays = new Set(workouts.filter((w) => !w.deletedAt).map((w) => w.date))
    const live = snacks.filter((s) => !s.deletedAt)
    if (live.length === 0) return null
    const noWorkout = live.filter((s) => !workoutDays.has(s.date)).length
    return noWorkout / live.length
  }, [snacks, workouts])

  function exportCsv() {
    const rows = [['date', 'heure', 'declencheur', 'contexte', 'issue']]
    const issue: Record<string, string> = {
      mange: 'mangé',
      'zone-libre': 'zone libre',
      passe: 'passé',
    }
    for (const s of [...snacks].filter((x) => !x.deletedAt).reverse()) {
      rows.push([s.date, s.time, s.trigger, s.context, s.outcome ? issue[s.outcome] : '—'])
    }
    const csv = rows.map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mes-declencheurs.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // §7.10 : les analyses n'apparaissent pas avant 14 jours — on explique pourquoi. La
  // liste des épisodes récents (avec suppression) reste toujours accessible.
  if (daysOfData < 14) {
    return (
      <div className="space-y-5">
        <RecentsList snacks={snacks} />
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Tes déclencheurs s'afficheront après <strong>14 jours</strong> de données. Un motif
          tiré de quelques épisodes est du bruit — mieux vaut attendre d'y voir clair.
          {snacks.length > 0 && ` (${daysOfData} jour${daysOfData > 1 ? 's' : ''} pour l'instant.)`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <RecentsList snacks={snacks} />
      {peak && (
        <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm">
          Ta bande la plus chargée : <strong>{DAY_FULL[peak.weekday]}</strong> vers{' '}
          <strong>
            {peak.hourBucket * 2}h–{peak.hourBucket * 2 + 2}h
          </strong>{' '}
          ({peak.count} épisodes).
        </p>
      )}

      {/* Carte de chaleur jour × tranche de 2 h. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Quand surviennent tes envies
        </h2>
        <div className="overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th></th>
                {DAY_SHORT.map((d, i) => (
                  <th key={i} className="w-7 text-[10px] font-normal text-[var(--text-muted)]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, b) => (
                <tr key={b}>
                  <td className="pr-1 text-right text-[10px] tabular-nums text-[var(--text-muted)]">
                    {b * 2}h
                  </td>
                  {Array.from({ length: 7 }, (_, wd) => {
                    const count = heatmap[wd as Weekday]?.[b] ?? 0
                    return (
                      <td
                        key={wd}
                        title={count ? `${count}` : ''}
                        className="h-5 w-7 rounded-sm border border-[var(--border)]"
                        style={{ background: cellBg(count, maxCell) }}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Répartition des déclencheurs. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Tes déclencheurs
        </h2>
        <ul className="space-y-1.5">
          {triggerCounts.map(([t, n]) => (
            <li key={t} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0">{TRIGGER_LABELS[t]}</span>
              <span className="h-3 flex-1 rounded-full bg-[var(--surface-2)]">
                <span
                  className="block h-3 rounded-full"
                  style={{ width: `${(n / triggerMax) * 100}%`, background: 'var(--accent)' }}
                />
              </span>
              <span className="w-6 text-right tabular-nums text-[var(--text-muted)]">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Taux de dissipation. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Envies qui se dissipent (30 j)
        </h2>
        {dissip == null ? (
          <p className="text-sm text-[var(--text-muted)]">Pas encore assez de données.</p>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
              {pct(dissip)}
            </p>
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              part des envies passées ou résolues dans la zone libre — la vraie victoire, c'est
              que ça monte.
            </p>
            <div className="flex items-end gap-2">
              {weekly.map((w, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end rounded bg-[var(--surface-2)]">
                    <div
                      className="w-full rounded"
                      style={{ height: `${(w ?? 0) * 100}%`, background: 'var(--accent)' }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {i === 3 ? 'cette sem.' : `S-${3 - i}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Croisement séances — constat factuel. */}
      {crossing != null && (
        <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text-muted)]">
          {pct(crossing)} de tes épisodes surviennent les jours sans séance.
        </p>
      )}

      <button
        type="button"
        onClick={exportCsv}
        className="w-full rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium"
      >
        Exporter en CSV
      </button>
    </div>
  )
}
