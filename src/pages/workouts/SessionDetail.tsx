import type { WorkoutSession } from '../../domain/types'
import { exerciseById } from '../../data/catalog'
import { exerciseVolume, topWeight } from '../../domain/workout'

function frDate(d: string) {
  return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}
function fmt(n: number) {
  return n.toFixed(1).replace('.', ',').replace(',0', '')
}

export function SessionDetail({
  session,
  onBack,
}: {
  session: WorkoutSession
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Séance {session.templateId}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {frDate(session.date)}
            {session.durationMin ? ` · ${session.durationMin} min` : ''}
            {session.completed ? ' · terminée' : ' · partielle'}
          </p>
        </div>
        <button type="button" onClick={onBack} className="text-sm text-[var(--text-muted)] underline">
          Retour
        </button>
      </div>

      {session.entries.map((entry) => {
        const ex = exerciseById(entry.exerciseId)
        const isTime = ex?.unit === 'seconds'
        const skipped = entry.sets.every((s) => s.skipped)
        const vol = exerciseVolume(entry.sets, ex?.unit ?? 'reps')
        return (
          <section
            key={entry.exerciseId}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{ex?.label ?? entry.exerciseId}</h2>
              {!skipped && (
                <span className="text-xs text-[var(--text-muted)]">
                  {isTime ? `${vol} s au total` : `${topWeight(entry.sets)} kg max · vol. ${vol}`}
                </span>
              )}
            </div>
            {skipped ? (
              <p className="text-sm text-[var(--text-muted)]">Exercice passé</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {entry.sets.map((s, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-6 text-xs text-[var(--text-muted)]">#{i + 1}</span>
                    {s.skipped ? (
                      <span className="text-[var(--text-muted)]">passée</span>
                    ) : isTime ? (
                      <span className="tabular-nums">{s.reps} s</span>
                    ) : (
                      <span className="tabular-nums">
                        {s.reps} reps
                        {s.weightKg != null ? ` × ${fmt(s.weightKg)} kg` : ' · poids du corps'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
