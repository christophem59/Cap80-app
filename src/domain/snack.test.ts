import { describe, it, expect } from 'vitest'
import type { SnackLog } from './types'
import { snackHeatmap, dissipationRate, peakWindow, weekdayOf, hourBucket } from './snack'

function log(date: string, time: string, outcome: SnackLog['outcome'] = null): SnackLog {
  return {
    id: `${date}-${time}`,
    date,
    time,
    trigger: 'ennui',
    context: 'ecran-soir',
    outcome,
    updatedAt: `${date}T00:00:00.000Z`,
  }
}

describe('weekdayOf / hourBucket', () => {
  it('lundi = 0', () => {
    expect(weekdayOf('2026-08-03')).toBe(0) // 3 août 2026 = lundi
    expect(weekdayOf('2026-08-09')).toBe(6) // dimanche
  })
  it('tranches de 2 h', () => {
    expect(hourBucket('00:15')).toBe(0)
    expect(hourBucket('21:45')).toBe(10)
    expect(hourBucket('23:59')).toBe(11)
  })
})

describe('snackHeatmap (§6 bis, DST)', () => {
  it('compte un épisode de 2 h 30 la nuit du changement d\'heure une seule fois', () => {
    // 25 oct. 2026 = nuit du passage à l'heure d'hiver en France.
    const logs = [log('2026-10-25', '02:30')]
    const hm = snackHeatmap(logs, 4, '2026-10-25')
    const wd = weekdayOf('2026-10-25')
    expect(hm[wd][1]).toBe(1) // bucket [2h,4h[, compté une fois
    // aucun double comptage ailleurs
    const total = Object.values(hm).reduce(
      (s, row) => s + Object.values(row).reduce((a, b) => a + b, 0),
      0,
    )
    expect(total).toBe(1)
  })
  it('exclut hors fenêtre et supprimés', () => {
    const logs = [
      log('2026-08-09', '21:00'),
      { ...log('2026-08-09', '21:30'), deletedAt: '2026-08-09T00:00:00.000Z' },
      log('2026-06-01', '21:00'), // trop ancien
    ]
    const hm = snackHeatmap(logs, 4, '2026-08-09')
    const total = Object.values(hm).reduce(
      (s, row) => s + Object.values(row).reduce((a, b) => a + b, 0),
      0,
    )
    expect(total).toBe(1)
  })
})

describe('dissipationRate (§6 bis)', () => {
  it('null sous 5 épisodes décidés', () => {
    const logs = [log('2026-08-01', '21:00', 'passe'), log('2026-08-02', '21:00', 'mange')]
    expect(dissipationRate(logs, '2026-08-01', '2026-08-31')).toBeNull()
  })
  it('part des passe + zone-libre', () => {
    const logs = [
      log('2026-08-01', '21:00', 'passe'),
      log('2026-08-02', '21:00', 'zone-libre'),
      log('2026-08-03', '21:00', 'mange'),
      log('2026-08-04', '21:00', 'mange'),
      log('2026-08-05', '21:00', 'passe'),
    ]
    // 3 dissipés / 5 = 0,6
    expect(dissipationRate(logs, '2026-08-01', '2026-08-31')).toBeCloseTo(0.6, 5)
  })
})

describe('peakWindow (§6 bis)', () => {
  it('null sous 10 épisodes', () => {
    const logs = Array.from({ length: 9 }, (_, i) => log('2026-08-09', '21:00'))
    expect(peakWindow(logs)).toBeNull()
  })
  it('trouve le créneau le plus chargé', () => {
    const logs = [
      ...Array.from({ length: 8 }, () => log('2026-08-09', '21:15')), // dim, bucket 10
      ...Array.from({ length: 3 }, () => log('2026-08-03', '13:00')), // lun, bucket 6
    ]
    const pw = peakWindow(logs)
    expect(pw).toEqual({ weekday: 6, hourBucket: 10, count: 8 })
  })
})
