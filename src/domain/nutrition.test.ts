import { describe, it, expect } from 'vitest'
import planDefault from '../data/plan.default.json'
import type { Plan, MealItem, Phase } from './types'
import { dailyTotals } from './nutrition'

const plan = planDefault as Plan
const p1 = plan.phases.find((p) => p.id === 'p1')! // 2200/180/75/200, fibres 30
const p0 = plan.phases.find((p) => p.id === 'p0')! // calibrage : cibles nulles

function item(partial: Partial<MealItem>): MealItem {
  return {
    label: 'x',
    grams: 100,
    kcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    ...partial,
  }
}

describe('dailyTotals (§6.8)', () => {
  it('somme les items et compare aux cibles de la phase', () => {
    const items = [
      item({ kcal: 1500, proteinG: 120, fatG: 40, carbsG: 120, fiberG: 20 }),
      item({ kcal: 600, proteinG: 70, fatG: 20, carbsG: 70, fiberG: 12 }),
    ]
    const t = dailyTotals(items, p1)
    expect(t.kcal).toMatchObject({ value: 2100, target: 2200, status: 'ok' })
    expect(t.proteinG).toMatchObject({ value: 190, status: 'ok' }) // ≥ 180
    expect(t.fiberG).toMatchObject({ value: 32, status: 'ok' }) // ≥ 30
  })

  it('protéines sous la cible → under (à atteindre ou dépasser)', () => {
    const t = dailyTotals([item({ proteinG: 150 })], p1)
    expect(t.proteinG.status).toBe('under')
    expect(t.proteinG.diff).toBe(-30)
  })

  it('kcal au-dessus du plafond → over, écart signé', () => {
    const t = dailyTotals([item({ kcal: 2300 })], p1)
    expect(t.kcal.status).toBe('over')
    expect(t.kcal.diff).toBe(100)
  })

  it('phase de calibrage : pas de cible kcal/protéines, mais minimum de fibres', () => {
    const t = dailyTotals([item({ kcal: 2000, proteinG: 100, fiberG: 10 })], p0 as Phase)
    expect(t.kcal.status).toBe('none')
    expect(t.proteinG.status).toBe('none')
    expect(t.fiberG.status).toBe('under') // fibres min 30 même en calibrage
  })
})
