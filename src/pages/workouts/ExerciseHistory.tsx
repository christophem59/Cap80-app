import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { exerciseById } from '../../data/catalog'
import { toDayNumber } from '../../domain/dates'
import { exerciseVolume, topWeight } from '../../domain/workout'
import { useWorkouts } from '../../repo/workouts'

function fmtDate(t: number) {
  const d = new Date(t)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function Mini({
  data,
  dataKey,
  suffix,
}: {
  data: { t: number; charge: number; volume: number }[]
  dataKey: 'charge' | 'volume'
  suffix: string
}) {
  return (
    <div style={{ width: '100%', height: 130 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtDate}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            stroke="var(--border)"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            width={38}
            stroke="var(--border)"
          />
          <Tooltip
            labelFormatter={(t) => fmtDate(Number(t))}
            formatter={(v: number) => [`${v} ${suffix}`, dataKey === 'charge' ? 'Charge' : 'Volume']}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line dataKey={dataKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ExerciseHistory({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const ex = exerciseById(exerciseId)
  const workouts = useWorkouts()

  const data = workouts
    .map((w) => {
      const entry = w.entries.find((e) => e.exerciseId === exerciseId)
      if (!entry || !entry.sets.some((s) => !s.skipped)) return null
      return {
        t: toDayNumber(w.date) * 86_400_000,
        charge: topWeight(entry.sets),
        volume: exerciseVolume(entry.sets, ex?.unit ?? 'reps'),
      }
    })
    .filter((x): x is { t: number; charge: number; volume: number } => !!x)
    .sort((a, b) => a.t - b.t)

  const isTime = ex?.unit === 'seconds'

  // « Volume plat » : peu de variation sur les 3+ derniers points → message positif (§7.4).
  let plateauMsg: string | null = null
  if (data.length >= 3) {
    const vols = data.slice(-4).map((d) => d.volume)
    const min = Math.min(...vols)
    const max = Math.max(...vols)
    if (max > 0 && (max - min) / max < 0.08) {
      plateauMsg =
        'Volume stable : en déficit, maintenir le volume est déjà une victoire (tu préserves ta masse).'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{ex?.label ?? exerciseId}</h1>
        <button type="button" onClick={onBack} className="text-sm text-[var(--text-muted)] underline">
          Retour
        </button>
      </div>

      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Pas encore de données pour cet exercice.
        </p>
      ) : (
        <>
          {!isTime && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Charge max (kg)
              </h2>
              <Mini data={data} dataKey="charge" suffix="kg" />
            </section>
          )}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Volume {isTime ? '(secondes)' : '(tonnage : Σ reps × kg)'}
            </h2>
            <Mini data={data} dataKey="volume" suffix={isTime ? 's' : 'kg'} />
          </section>
          {plateauMsg && (
            <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text-muted)]">
              {plateauMsg}
            </p>
          )}
        </>
      )}
    </div>
  )
}
