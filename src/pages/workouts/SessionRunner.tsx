import { useMemo, useRef, useState } from 'react'
import type { Exercise, WorkoutSession, WorkoutTemplateId } from '../../domain/types'
import { exerciseById, workoutTemplates } from '../../data/catalog'
import { todayLocal, calendarWeek, nowIso } from '../../domain/dates'
import { reducedSetCount, suggestProgression, lastSetsForExercise } from '../../domain/workout'
import { useProfile } from '../../repo/profile'
import { saveWorkout } from '../../repo/workouts'
import { RestBanner } from './RestBanner'

type RunnerSet = { reps: string; weight: string; done: boolean }
type RunnerExercise = { ex: Exercise; sets: RunnerSet[]; skipped: boolean; cuesOpen: boolean }

const REST_SECONDS = 90

function makeId(date: string, template: string): string {
  // Un id unique par séance (plusieurs séances possibles le même jour).
  return `${date}-${template}-${Math.abs(hash(nowIso()))}`
}
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h | 0
}

export function SessionRunner({
  templateId,
  pastWorkouts,
  onDone,
  onCancel,
}: {
  templateId: Exclude<WorkoutTemplateId, 'custom'>
  pastWorkouts: WorkoutSession[]
  onDone: () => void
  onCancel: () => void
}) {
  const profile = useProfile()
  const workouts = pastWorkouts
  const week = calendarWeek(profile.startDate, todayLocal())
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)

  // Construit l'état initial une seule fois (pré-remplissage depuis la dernière fois).
  const initial = useMemo<RunnerExercise[]>(() => {
    return workoutTemplates[templateId]
      .map((id) => exerciseById(id))
      .filter((e): e is Exercise => !!e)
      .map((ex) => {
        const last = lastSetsForExercise(workouts, ex.id)
        const count = reducedSetCount(ex.defaultSets, week)
        const sets: RunnerSet[] = Array.from({ length: count }, (_, i) => {
          const prev = last?.[i]
          return {
            reps:
              prev && prev.reps > 0
                ? String(prev.reps)
                : ex.unit === 'seconds'
                  ? String(ex.repRange[0])
                  : '',
            weight: prev?.weightKg != null ? String(prev.weightKg) : '',
            done: false,
          }
        })
        return { ex, sets, skipped: false, cuesOpen: false }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [exercises, setExercises] = useState<RunnerExercise[]>(initial)
  const startedAt = useRef(Date.now())

  function update(exIdx: number, fn: (e: RunnerExercise) => RunnerExercise) {
    setExercises((prev) => prev.map((e, i) => (i === exIdx ? fn(e) : e)))
  }

  function setField(exIdx: number, setIdx: number, key: 'reps' | 'weight', value: string) {
    update(exIdx, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === setIdx ? { ...s, [key]: value } : s)),
    }))
  }

  function toggleDone(exIdx: number, setIdx: number) {
    update(exIdx, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === setIdx ? { ...s, done: !s.done } : s)),
    }))
    // Déclenche le repos quand on valide (pas quand on dévalide).
    const wasDone = exercises[exIdx].sets[setIdx].done
    if (!wasDone) setRestEndsAt(Date.now() + REST_SECONDS * 1000)
  }

  function applyProgression(exIdx: number, kind: 'weight' | 'reps', delta: number) {
    update(exIdx, (e) => ({
      ...e,
      sets: e.sets.map((s) => {
        if (kind === 'weight') {
          const w = parseFloat(s.weight.replace(',', '.'))
          return { ...s, weight: Number.isFinite(w) ? String(Math.round((w + delta) * 10) / 10) : String(delta) }
        }
        const r = parseInt(s.reps || '0', 10)
        return { ...s, reps: String(r + delta) }
      }),
    }))
  }

  function finish() {
    const session: WorkoutSession = {
      id: makeId(todayLocal(), templateId),
      date: todayLocal(),
      templateId,
      durationMin: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
      entries: exercises.map((e) => ({
        exerciseId: e.ex.id,
        sets: e.skipped
          ? e.sets.map(() => ({ reps: 0, weightKg: null, skipped: true }))
          : e.sets.map((s) => ({
              reps: parseInt(s.reps || '0', 10) || 0,
              weightKg: s.weight === '' ? null : Math.round(parseFloat(s.weight.replace(',', '.')) * 10) / 10,
            })),
      })),
      completed: exercises.every((e) => e.skipped || e.sets.every((s) => s.done)),
      updatedAt: nowIso(),
    }
    void saveWorkout(session).then(onDone)
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Séance {templateId}</h1>
        <button type="button" onClick={onCancel} className="text-sm text-[var(--text-muted)] underline">
          Annuler
        </button>
      </div>

      {week >= 1 && week <= 2 && (
        <p className="rounded-lg bg-[var(--surface-2)] p-2 text-xs text-[var(--text-muted)]">
          Semaines 1-2 : moitié des séries prévues, le temps que le corps s'habitue.
        </p>
      )}

      {exercises.map((e, exIdx) => {
        const last = lastSetsForExercise(workouts, e.ex.id)
        const prog = last ? suggestProgression(last, e.ex.repRange) : null
        const isTime = e.ex.unit === 'seconds'
        return (
          <section
            key={e.ex.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            style={{ opacity: e.skipped ? 0.5 : 1 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{e.ex.label}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {e.ex.defaultSets} × {e.ex.repRange[0]}
                  {e.ex.repRange[0] !== e.ex.repRange[1] ? `–${e.ex.repRange[1]}` : ''}{' '}
                  {isTime ? 's' : 'reps'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => update(exIdx, (x) => ({ ...x, skipped: !x.skipped }))}
                className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]"
              >
                {e.skipped ? 'Reprendre' : 'Passer'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => update(exIdx, (x) => ({ ...x, cuesOpen: !x.cuesOpen }))}
              className="mt-1 text-xs underline"
              style={{ color: 'var(--accent)' }}
            >
              {e.cuesOpen ? 'Masquer les consignes' : 'Consignes'}
            </button>
            {e.cuesOpen && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--text-muted)]">
                {e.ex.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}

            {prog && !e.skipped && (
              <button
                type="button"
                onClick={() => applyProgression(exIdx, prog.kind, prog.delta)}
                className="mt-2 w-full rounded-lg border border-dashed px-3 py-1.5 text-xs"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                Tu as tenu le haut de la fourchette la dernière fois → progresse de {prog.label}{' '}
                (appliquer)
              </button>
            )}

            {!e.skipped && (
              <div className="mt-3 space-y-2">
                {e.sets.map((s, setIdx) => (
                  <div key={setIdx} className="flex items-center gap-2">
                    <span className="w-6 text-xs text-[var(--text-muted)]">#{setIdx + 1}</span>
                    {!isTime && (
                      <label className="flex-1">
                        <input
                          inputMode="decimal"
                          placeholder="kg"
                          value={s.weight}
                          onChange={(ev) => setField(exIdx, setIdx, 'weight', ev.target.value)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-center text-sm tabular-nums"
                        />
                      </label>
                    )}
                    <label className="flex-1">
                      <input
                        inputMode="numeric"
                        placeholder={isTime ? 'sec' : 'reps'}
                        value={s.reps}
                        onChange={(ev) => setField(exIdx, setIdx, 'reps', ev.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-center text-sm tabular-nums"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleDone(exIdx, setIdx)}
                      aria-label={s.done ? 'Série validée' : 'Valider la série'}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm"
                      style={
                        s.done
                          ? { background: 'var(--ok)', borderColor: 'transparent', color: '#fff' }
                          : { borderColor: 'var(--border)' }
                      }
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <button
        type="button"
        onClick={finish}
        className="w-full rounded-xl py-3 text-base font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        Terminer la séance
      </button>

      {restEndsAt && <RestBanner endsAt={restEndsAt} onClose={() => setRestEndsAt(null)} />}
    </div>
  )
}
