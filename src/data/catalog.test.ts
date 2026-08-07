import { describe, it, expect } from 'vitest'
import { defaultPlan, exercises, workoutTemplates, exerciseById } from './catalog'

describe('catalogue exercices (§8.2)', () => {
  it('chaque exercice a 2 à 4 consignes et une fourchette valide', () => {
    for (const e of exercises) {
      expect(e.cues.length, e.id).toBeGreaterThanOrEqual(2)
      expect(e.cues.length, e.id).toBeLessThanOrEqual(4)
      expect(e.repRange[0], e.id).toBeLessThanOrEqual(e.repRange[1])
      expect(e.defaultSets, e.id).toBe(3)
    }
  })

  it('le gainage se compte en secondes', () => {
    for (const e of exercises.filter((x) => x.pattern === 'gainage')) {
      expect(e.unit, e.id).toBe('seconds')
    }
  })

  it('les séances A et B référencent des exercices existants', () => {
    for (const id of [...workoutTemplates.A, ...workoutTemplates.B]) {
      expect(exerciseById(id), id).toBeDefined()
    }
    expect(workoutTemplates.A).toHaveLength(5)
    expect(workoutTemplates.B).toHaveLength(5)
  })
})

describe('catalogue plan par défaut (§8.1)', () => {
  it('7 phases, bornes calendaires contiguës', () => {
    expect(defaultPlan.phases).toHaveLength(7)
    const sorted = [...defaultPlan.phases].sort(
      (a, b) => a.startCalendarWeek - b.startCalendarWeek,
    )
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].endCalendarWeek
      // Chaque phase commence juste après la fin de la précédente.
      expect(sorted[i].startCalendarWeek).toBe((prevEnd ?? Infinity) + 1)
    }
  })

  it('un objectif de pas par phase', () => {
    for (const p of defaultPlan.phases) {
      expect(defaultPlan.stepGoals[p.id], p.id).toBeTypeOf('number')
    }
  })

  it('la phase 4 porte une rampe +100 kcal/sem', () => {
    const p4 = defaultPlan.phases.find((p) => p.id === 'p4')!
    expect(p4.ramp).toEqual({ fromKcal: 2100, toKcal: 2550, stepPerWeek: 100 })
  })
})
