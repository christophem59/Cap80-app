import { describe, it, expect } from 'vitest'
import { daysBetween, addDays, calendarWeek, toDayNumber } from './dates'

describe('dates', () => {
  it('daysBetween compte les jours, DST comprise', () => {
    expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7)
    expect(daysBetween('2026-08-08', '2026-08-01')).toBe(-7)
    // Passage à l'heure d'hiver en France : nuit du 24 au 25 octobre 2026.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    // Passage à l'heure d'été : nuit du 28 au 29 mars 2026.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('addDays traverse les mois et les années', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-08-17', 7)).toBe('2026-08-24')
  })

  it('toDayNumber est cohérent avec addDays', () => {
    expect(toDayNumber('2026-08-18') - toDayNumber('2026-08-17')).toBe(1)
  })

  describe('calendarWeek (§6.3)', () => {
    const start = '2026-08-17'
    it('semaine 1 = les 7 premiers jours', () => {
      expect(calendarWeek(start, '2026-08-17')).toBe(1)
      expect(calendarWeek(start, '2026-08-23')).toBe(1)
      expect(calendarWeek(start, '2026-08-24')).toBe(2)
      expect(calendarWeek(start, '2026-08-30')).toBe(2)
    })
    it('calibrage = semaine 0 sur les 7 jours précédents, sans planter', () => {
      expect(calendarWeek(start, '2026-08-16')).toBe(0)
      expect(calendarWeek(start, '2026-08-10')).toBe(0)
      // Au-delà : semaines négatives tolérées.
      expect(calendarWeek(start, '2026-08-09')).toBe(-1)
    })
  })
})
