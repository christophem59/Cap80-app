import { describe, it, expect } from 'vitest'
import type { MealLog, MealItem, WeightEntry } from './types'
import { buildWeekEnergyRows } from './weekEnergy'

const START = '2026-08-24' // lundi : S1 = 24/08 → 30/08
const ts = '2026-09-18T06:00:00.000Z'

const w = (date: string, kg: number): WeightEntry => ({
  id: `${date}-weight`,
  date,
  weightKg: kg,
  updatedAt: ts,
})
const item = (kcal: number): MealItem => ({
  label: 'x',
  grams: null,
  kcal,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  fiberG: 0,
})
const meal = (date: string, kcal: number): MealLog => ({
  id: `${date}-diner`,
  date,
  slot: 'diner',
  items: [item(kcal)],
  updatedAt: ts,
})

describe('observations hebdomadaires (§6.9)', () => {
  it('moyenne les pesées et les apports par semaine de programme', () => {
    const rows = buildWeekEnergyRows(
      [w('2026-08-24', 99.0), w('2026-08-26', 98.8), w('2026-09-01', 97.4)],
      [meal('2026-08-24', 2200), meal('2026-08-26', 2400)],
      START,
    )
    expect(rows.map((r) => r.week)).toEqual([1, 2])
    expect(rows[0].avgWeightKg).toBeCloseTo(98.9, 5)
    expect(rows[0].avgIntakeKcal).toBe(2300)
    expect(rows[0].weighIns).toBe(2)
    expect(rows[0].loggedDays).toBe(2)
  })

  it('un jour non saisi ne compte pas comme un jour à 0 kcal', () => {
    const rows = buildWeekEnergyRows([w('2026-08-24', 99)], [meal('2026-08-24', 2200)], START)
    expect(rows[0].avgIntakeKcal).toBe(2200)
  })

  it('additionne les créneaux d’un même jour avant de moyenner', () => {
    const rows = buildWeekEnergyRows(
      [w('2026-08-24', 99)],
      [meal('2026-08-24', 1200), { ...meal('2026-08-24', 800), id: '2026-08-24-dejeuner', slot: 'dejeuner' }],
      START,
    )
    expect(rows[0].avgIntakeKcal).toBe(2000)
  })

  it('laisse l’apport à null quand aucun repas n’est saisi — la fenêtre se coupe', () => {
    const rows = buildWeekEnergyRows([w('2026-08-24', 99)], [], START)
    expect(rows[0].avgIntakeKcal).toBeNull()
  })

  it('une correction manuelle prime, mais la valeur calculée reste lisible', () => {
    const rows = buildWeekEnergyRows(
      [w('2026-08-24', 99)],
      [meal('2026-08-24', 2500)],
      START,
      [{ week: 1, avgIntakeKcal: 2200, estimated: true, note: 'forfait resto surestimé' }],
    )
    expect(rows[0].avgIntakeKcal).toBe(2200)
    expect(rows[0].computedIntakeKcal).toBe(2500)
    expect(rows[0].overridden).toBe(true)
    expect(rows[0].note).toBe('forfait resto surestimé')
  })

  it('marque comme estimée une semaine saisie moins de 6 jours sur 7', () => {
    const rows = buildWeekEnergyRows(
      [w('2026-08-24', 99)],
      ['2026-08-24', '2026-08-25', '2026-08-26'].map((d) => meal(d, 2200)),
      START,
    )
    expect(rows[0].estimated).toBe(true)
  })

  it('ignore les enregistrements supprimés (tombstones §5.4)', () => {
    const rows = buildWeekEnergyRows(
      [w('2026-08-24', 99), { ...w('2026-08-25', 80), deletedAt: ts }],
      [{ ...meal('2026-08-24', 9000), deletedAt: ts }],
      START,
    )
    expect(rows[0].avgWeightKg).toBe(99)
    expect(rows[0].avgIntakeKcal).toBeNull()
  })

  it('une semaine sans poids n’est pas retenue', () => {
    const rows = buildWeekEnergyRows([], [meal('2026-08-24', 2200)], START)
    expect(rows).toEqual([])
  })
})
