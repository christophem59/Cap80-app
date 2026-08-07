import { describe, it, expect } from 'vitest'
import planDefault from '../data/plan.default.json'
import type { Plan, BmrProfile } from './types'
import { projectTrajectory, weekCrossingTarget } from './projection'

const plan = planDefault as Plan
const profile: BmrProfile = {
  heightCm: 192,
  ageYears: 34,
  sex: 'male',
  activityFactor: 1.4,
}

// Le plan par défaut donne, par deficitWeek : 2200 (dw1-12), 2150 (dw13-26),
// 2100 (dw27-42) — exactement le scénario de référence du §6.6.
const points = projectTrajectory(100.0, plan, profile, 42)
const round1 = (x: number) => Math.round(x * 10) / 10
const at = (dw: number) => round1(points[dw - 1].weightKg)

describe('projection (§6.6) — valeurs de référence à 0,1 kg près', () => {
  it('S1 = 99,4', () => expect(at(1)).toBe(99.4))
  it('S12 = 93,4', () => expect(at(12)).toBe(93.4))
  it('S26 = 86,3', () => expect(at(26)).toBe(86.3))
  it('S40 = 79,8', () => expect(at(40)).toBe(79.8))
  it('S42 = 78,9', () => expect(at(42)).toBe(78.9))

  it('franchit les 80 kg en semaine (déficit) 40', () => {
    expect(weekCrossingTarget(points, 80)).toBe(40)
  })

  it('chaque point porte bien sa conversion deficitWeek → calendarWeek', () => {
    expect(points[0]).toMatchObject({ deficitWeek: 1, calendarWeek: 1 })
    expect(points[12]).toMatchObject({ deficitWeek: 13, calendarWeek: 14 })
    expect(points[26]).toMatchObject({ deficitWeek: 27, calendarWeek: 29 })
    expect(points[41]).toMatchObject({ deficitWeek: 42, calendarWeek: 44 })
  })
})
