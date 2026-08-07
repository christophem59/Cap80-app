import { describe, it, expect } from 'vitest'
import type { WeightEntry } from './types'
import { trailingAvg, weeklyAverages, lossRate } from './weight'

function w(date: string, weightKg: number, deleted = false): WeightEntry {
  return {
    id: `${date}-weight`,
    date,
    weightKg,
    updatedAt: `${date}T07:00:00.000Z`,
    ...(deleted ? { deletedAt: `${date}T08:00:00.000Z` } : {}),
  }
}

const START = '2026-08-17' // lundi, semaine 1

describe('trailingAvg (§6.4)', () => {
  it('null sous 4 pesées dans la fenêtre', () => {
    const e = [w('2026-08-21', 99), w('2026-08-22', 98.8), w('2026-08-23', 98.6)]
    expect(trailingAvg(e, '2026-08-23')).toBeNull()
  })

  it('moyenne sur la fenêtre de 7 jours quand ≥ 4 pesées', () => {
    const e = [
      w('2026-08-20', 100),
      w('2026-08-21', 99),
      w('2026-08-22', 98),
      w('2026-08-23', 97),
    ]
    expect(trailingAvg(e, '2026-08-23')).toBeCloseTo(98.5, 5)
  })

  it('ignore les pesées hors fenêtre et les tombstones', () => {
    const e = [
      w('2026-08-10', 105), // hors fenêtre (trop ancienne)
      w('2026-08-20', 100),
      w('2026-08-21', 99),
      w('2026-08-22', 98, true), // supprimée
      w('2026-08-23', 97),
    ]
    // Seules 3 pesées valides dans la fenêtre → null.
    expect(trailingAvg(e, '2026-08-23')).toBeNull()
  })
})

describe('weeklyAverages', () => {
  it('regroupe par semaine de programme et filtre par minCount', () => {
    const e = [
      w('2026-08-17', 100), // S1
      w('2026-08-18', 99.6), // S1
      w('2026-08-24', 99), // S2
    ]
    const all = weeklyAverages(e, START)
    expect(all).toEqual([
      { week: 1, avg: expect.closeTo(99.8, 5), count: 2 },
      { week: 2, avg: 99, count: 1 },
    ])
    // minCount=2 exclut la semaine 2 (une seule pesée).
    expect(weeklyAverages(e, START, 2).map((x) => x.week)).toEqual([1])
  })

  it('exclut les tombstones', () => {
    const e = [w('2026-08-17', 100), w('2026-08-18', 90, true)]
    expect(weeklyAverages(e, START)).toEqual([{ week: 1, avg: 100, count: 1 }])
  })
})

describe('lossRate (§6.5)', () => {
  const weekly = [
    { week: 1, avg: 100, count: 7 },
    { week: 2, avg: 99.5, count: 7 },
    { week: 3, avg: 99, count: 7 },
    { week: 4, avg: 98.5, count: 7 },
  ]

  it('pente négative quand il y a perte', () => {
    expect(lossRate(weekly, 3)).toBeCloseTo(-0.5, 5)
    expect(lossRate(weekly, 4)).toBeCloseTo(-0.5, 5)
  })

  it('null si moins de `weeks` semaines disponibles', () => {
    expect(lossRate(weekly.slice(0, 2), 3)).toBeNull()
    expect(lossRate(weekly, 6)).toBeNull()
  })

  it('robuste à une semaine de rétention isolée (régression, pas différence)', () => {
    const noisy = [
      { week: 1, avg: 100, count: 7 },
      { week: 2, avg: 99 , count: 7 },
      { week: 3, avg: 99.8, count: 7 }, // pic de rétention
      { week: 4, avg: 98, count: 7 },
    ]
    // La pente reste clairement négative malgré le pic.
    expect(lossRate(noisy, 4)!).toBeLessThan(-0.3)
  })
})
