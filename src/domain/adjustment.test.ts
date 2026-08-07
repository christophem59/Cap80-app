import { describe, it, expect } from 'vitest'
import type { WeeklyAvg } from './weight'
import { recommendAdjustment, applyKcalDelta, MIN_KCAL } from './adjustment'

// Construit des moyennes hebdomadaires avec une pente donnée (kg/semaine).
function series(startAvg: number, slopePerWeek: number, weeks: number): WeeklyAvg[] {
  return Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    avg: startAvg + slopePerWeek * i,
    count: 7,
  }))
}

const ctx = { phaseWeeksElapsed: 6 }

describe('recommendAdjustment (§6.7)', () => {
  it('refuse toute reco sous 3 semaines (§12.16)', () => {
    expect(recommendAdjustment(series(100, -0.5, 2), ctx)).toBeNull()
  })

  it('increase quand la perte dépasse 0,90 kg/sem', () => {
    const a = recommendAdjustment(series(100, -1.0, 3), ctx)!
    expect(a.recommendation).toBe('increase')
    expect(a.kcalDelta).toBe(150)
  })

  it('hold en zone idéale 0,40–0,90', () => {
    const a = recommendAdjustment(series(100, -0.5, 3), ctx)!
    expect(a.recommendation).toBe('hold')
    expect(a.warning).toBe(false)
  })

  it('hold avec avertissement en zone 0,30–0,40', () => {
    const a = recommendAdjustment(series(100, -0.35, 3), ctx)!
    expect(a.recommendation).toBe('hold')
    expect(a.warning).toBe(true)
  })

  it('decrease quand la perte est sous 0,30 (3 semaines, pas de plateau)', () => {
    const a = recommendAdjustment(series(100, -0.2, 3), ctx)!
    expect(a.recommendation).toBe('decrease')
    expect(a.kcalDelta).toBe(-100)
    expect(a.stepDelta).toBe(2000)
  })

  it('audit_journal (et non decrease) face à un plateau de 4 semaines (§12.16)', () => {
    const a = recommendAdjustment(series(100, -0.02, 4), ctx)!
    expect(a.recommendation).toBe('audit_journal')
    expect(a.weeksAnalysed).toBe(4)
    expect(a.kcalDelta).toBe(0)
  })

  it('diet_break après pesée stricte si la phase dure ≥ 10 semaines', () => {
    const a = recommendAdjustment(series(100, 0, 4), {
      phaseWeeksElapsed: 11,
      strictLoggingCompleted: true,
    })!
    expect(a.recommendation).toBe('diet_break')
  })

  it('decrease après pesée stricte si la phase est récente (< 10 semaines)', () => {
    const a = recommendAdjustment(series(100, 0, 4), {
      phaseWeeksElapsed: 5,
      strictLoggingCompleted: true,
    })!
    expect(a.recommendation).toBe('decrease')
  })
})

describe('plancher 1 800 kcal (§6.7 / §12.15)', () => {
  it('bloque toute descente sous 1 800 et le signale', () => {
    expect(applyKcalDelta(1850, -100)).toEqual({ kcal: MIN_KCAL, floored: true })
  })
  it('applique normalement au-dessus du plancher', () => {
    expect(applyKcalDelta(2100, -100)).toEqual({ kcal: 2000, floored: false })
  })
})
