import type { Exercise, WorkoutEntry, WorkoutSession } from './types'

export type WorkoutSet = { reps: number; weightKg: number | null; skipped?: boolean }

/**
 * §7.4 — Les 2 premières semaines du programme, moitié des séries prévues. On arrondit
 * à l'entier supérieur (au moins 1 série).
 */
export function reducedSetCount(defaultSets: number, calendarWeek: number): number {
  if (calendarWeek >= 1 && calendarWeek <= 2) return Math.max(1, Math.ceil(defaultSets / 2))
  return defaultSets
}

/**
 * §7.4 — Suggestion de progression : quand, la dernière fois, TOUTES les séries non
 * passées ont atteint le haut de la fourchette de répétitions, proposer +2 kg (si les
 * séries portaient une charge) ou +2 reps (poids du corps). null sinon.
 */
export function suggestProgression(
  lastSets: WorkoutSet[],
  repRange: [number, number],
): { kind: 'weight' | 'reps'; delta: number; label: string } | null {
  const done = lastSets.filter((s) => !s.skipped)
  if (done.length === 0) return null
  const allAtTop = done.every((s) => s.reps >= repRange[1])
  if (!allAtTop) return null
  const weighted = done.some((s) => s.weightKg != null && s.weightKg > 0)
  return weighted
    ? { kind: 'weight', delta: 2, label: '+2 kg' }
    : { kind: 'reps', delta: 2, label: '+2 reps' }
}

/**
 * Volume d'un exercice : tonnage (Σ reps × charge) pour les exercices chargés, ou
 * total de secondes/reps pour le poids du corps et le gainage. Séries passées exclues.
 */
export function exerciseVolume(sets: WorkoutSet[], unit: Exercise['unit']): number {
  const done = sets.filter((s) => !s.skipped)
  if (unit === 'seconds') return done.reduce((t, s) => t + s.reps, 0) // reps = secondes
  return done.reduce((t, s) => t + s.reps * (s.weightKg ?? 0), 0)
}

/** Charge de travail max d'un exercice (plus lourde série non passée), 0 si aucune. */
export function topWeight(sets: WorkoutSet[]): number {
  return sets.filter((s) => !s.skipped).reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0)
}

/**
 * §7.4 — Dernières séries réalisées d'un exercice, pour le pré-remplissage.
 * `sessions` supposé trié du plus récent au plus ancien.
 */
export function lastSetsForExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
): WorkoutSet[] | null {
  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId)
    if (entry && entry.sets.some((x) => !x.skipped)) return entry.sets
  }
  return null
}

/** Progression d'une séance : séries validées (saisies ou passées) vs total. */
export function sessionProgress(entries: WorkoutEntry[]): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const e of entries) {
    for (const s of e.sets) {
      total++
      if (s.skipped || s.reps > 0) done++
    }
  }
  return { done, total }
}
