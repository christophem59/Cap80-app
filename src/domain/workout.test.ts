import { describe, it, expect } from 'vitest'
import {
  reducedSetCount,
  suggestProgression,
  exerciseVolume,
  topWeight,
  sessionProgress,
} from './workout'
import type { WorkoutSet } from './workout'

describe('reducedSetCount (§7.4)', () => {
  it('moitié des séries les 2 premières semaines, au moins 1', () => {
    expect(reducedSetCount(3, 1)).toBe(2)
    expect(reducedSetCount(3, 2)).toBe(2)
    expect(reducedSetCount(3, 3)).toBe(3)
    expect(reducedSetCount(1, 1)).toBe(1)
  })
})

describe('suggestProgression (§7.4)', () => {
  const range: [number, number] = [8, 12]
  it('+2 kg quand toutes les séries chargées atteignent le haut de la fourchette', () => {
    const sets: WorkoutSet[] = [
      { reps: 12, weightKg: 20 },
      { reps: 12, weightKg: 20 },
    ]
    expect(suggestProgression(sets, range)).toMatchObject({ kind: 'weight', label: '+2 kg' })
  })
  it('+2 reps au poids du corps', () => {
    const sets: WorkoutSet[] = [
      { reps: 12, weightKg: null },
      { reps: 12, weightKg: null },
    ]
    expect(suggestProgression(sets, range)).toMatchObject({ kind: 'reps', label: '+2 reps' })
  })
  it('null si une série est sous le haut de la fourchette', () => {
    expect(
      suggestProgression([{ reps: 12, weightKg: 20 }, { reps: 10, weightKg: 20 }], range),
    ).toBeNull()
  })
  it('ignore les séries passées et null si tout est passé', () => {
    expect(suggestProgression([{ reps: 0, weightKg: null, skipped: true }], range)).toBeNull()
  })
})

describe('exerciseVolume', () => {
  it('tonnage pour les exercices chargés', () => {
    expect(exerciseVolume([{ reps: 10, weightKg: 20 }, { reps: 8, weightKg: 22 }], 'reps')).toBe(
      10 * 20 + 8 * 22,
    )
  })
  it('secondes pour le gainage', () => {
    expect(exerciseVolume([{ reps: 45, weightKg: null }], 'seconds')).toBe(45)
  })
  it('exclut les séries passées', () => {
    expect(
      exerciseVolume([{ reps: 10, weightKg: 20 }, { reps: 0, weightKg: null, skipped: true }], 'reps'),
    ).toBe(200)
  })
})

describe('topWeight & sessionProgress', () => {
  it('charge max non passée', () => {
    expect(topWeight([{ reps: 10, weightKg: 20 }, { reps: 8, weightKg: 24 }])).toBe(24)
  })
  it('progression : séries saisies ou passées', () => {
    const entries = [
      { exerciseId: 'a', sets: [{ reps: 10, weightKg: 20 }, { reps: 0, weightKg: null }] },
      { exerciseId: 'b', sets: [{ reps: 0, weightKg: null, skipped: true }] },
    ]
    expect(sessionProgress(entries)).toEqual({ done: 2, total: 3 })
  })
})
