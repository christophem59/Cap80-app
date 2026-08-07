import { useState } from 'react'
import { workoutTemplates, exerciseById } from '../data/catalog'
import { useWorkouts, deleteWorkout } from '../repo/workouts'
import { sessionProgress } from '../domain/workout'
import { SessionRunner } from './workouts/SessionRunner'
import { ExerciseHistory } from './workouts/ExerciseHistory'

type View =
  | { name: 'home' }
  | { name: 'session'; templateId: 'A' | 'B' }
  | { name: 'history'; exerciseId: string }

export function Workouts() {
  const [view, setView] = useState<View>({ name: 'home' })
  const workouts = useWorkouts()

  if (view.name === 'session') {
    return (
      <SessionRunner
        templateId={view.templateId}
        pastWorkouts={workouts}
        onDone={() => setView({ name: 'home' })}
        onCancel={() => setView({ name: 'home' })}
      />
    )
  }
  if (view.name === 'history') {
    return <ExerciseHistory exerciseId={view.exerciseId} onBack={() => setView({ name: 'home' })} />
  }

  const allExerciseIds = [...new Set([...workoutTemplates.A, ...workoutTemplates.B])]

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Séances</h1>

      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setView({ name: 'session', templateId: t })}
            className="rounded-xl px-4 py-5 text-left text-white"
            style={{ background: 'var(--accent)' }}
          >
            <span className="block text-lg font-semibold">Séance {t}</span>
            <span className="block text-xs opacity-90">
              {workoutTemplates[t].length} exercices — démarrer
            </span>
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Séances récentes</h2>
        {workouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
            Aucune séance enregistrée. Démarre une séance A ou B ci-dessus.
          </p>
        ) : (
          <ul className="space-y-2">
            {workouts.slice(0, 12).map((w) => {
              const { done, total } = sessionProgress(w.entries)
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {w.date.slice(8)}/{w.date.slice(5, 7)}
                  </span>
                  <span className="font-medium">Séance {w.templateId}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {done}/{total} séries
                    {w.durationMin ? ` · ${w.durationMin} min` : ''}
                    {w.completed ? ' · terminée' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteWorkout(w.id)}
                    className="ml-auto text-xs text-[var(--text-muted)] underline"
                  >
                    suppr.
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Progression par exercice</h2>
        <ul className="grid grid-cols-2 gap-2">
          {allExerciseIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setView({ name: 'history', exerciseId: id })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-xs"
              >
                {exerciseById(id)?.label ?? id}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
