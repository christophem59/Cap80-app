import { describe, it, expect } from 'vitest'
import planDefault from '../data/plan.default.json'
import type { Plan } from './types'
import {
  phaseForCalendarWeek,
  isPauseWeek,
  calendarWeekFromDeficitWeek,
  deficitWeekFromCalendarWeek,
  kcalForWeek,
} from './plan'

const plan = planDefault as Plan

describe('phaseForCalendarWeek', () => {
  it('associe chaque semaine à sa phase', () => {
    expect(phaseForCalendarWeek(plan, 0)?.id).toBe('p0')
    expect(phaseForCalendarWeek(plan, 1)?.id).toBe('p1')
    expect(phaseForCalendarWeek(plan, 12)?.id).toBe('p1')
    expect(phaseForCalendarWeek(plan, 13)?.id).toBe('break1')
    expect(phaseForCalendarWeek(plan, 14)?.id).toBe('p2')
    expect(phaseForCalendarWeek(plan, 27)?.id).toBe('p2')
    expect(phaseForCalendarWeek(plan, 28)?.id).toBe('break2')
    expect(phaseForCalendarWeek(plan, 29)?.id).toBe('p3')
    expect(phaseForCalendarWeek(plan, 44)?.id).toBe('p3')
    // Phase ouverte : au-delà de 44 → p4.
    expect(phaseForCalendarWeek(plan, 45)?.id).toBe('p4')
    expect(phaseForCalendarWeek(plan, 80)?.id).toBe('p4')
  })

  it('repère les pauses', () => {
    expect(isPauseWeek(plan, 13)).toBe(true)
    expect(isPauseWeek(plan, 28)).toBe(true)
    expect(isPauseWeek(plan, 12)).toBe(false)
    expect(isPauseWeek(plan, 14)).toBe(false)
  })
})

describe('conversions deficitWeek ↔ calendarWeek (§6.6) — les quatre bornes de pause', () => {
  it('deficitWeek → calendarWeek', () => {
    expect(calendarWeekFromDeficitWeek(plan, 1)).toBe(1)
    expect(calendarWeekFromDeficitWeek(plan, 12)).toBe(12)
    expect(calendarWeekFromDeficitWeek(plan, 13)).toBe(14) // saute la pause S13
    expect(calendarWeekFromDeficitWeek(plan, 26)).toBe(27)
    expect(calendarWeekFromDeficitWeek(plan, 27)).toBe(29) // saute la pause S28
    expect(calendarWeekFromDeficitWeek(plan, 42)).toBe(44)
    expect(calendarWeekFromDeficitWeek(plan, 43)).toBe(45) // premières semaines de p4
  })

  it('calendarWeek → deficitWeek', () => {
    expect(deficitWeekFromCalendarWeek(plan, 12)).toBe(12)
    expect(deficitWeekFromCalendarWeek(plan, 13)).toBeNull() // pause
    expect(deficitWeekFromCalendarWeek(plan, 14)).toBe(13)
    expect(deficitWeekFromCalendarWeek(plan, 27)).toBe(26)
    expect(deficitWeekFromCalendarWeek(plan, 28)).toBeNull() // pause
    expect(deficitWeekFromCalendarWeek(plan, 29)).toBe(27)
    expect(deficitWeekFromCalendarWeek(plan, 44)).toBe(42)
    // Calibrage / avant la semaine 1.
    expect(deficitWeekFromCalendarWeek(plan, 0)).toBeNull()
  })

  it('aller-retour cohérent pour toutes les semaines en déficit', () => {
    for (let dw = 1; dw <= 42; dw++) {
      const cw = calendarWeekFromDeficitWeek(plan, dw)
      expect(deficitWeekFromCalendarWeek(plan, cw)).toBe(dw)
    }
  })
})

describe('kcalForWeek', () => {
  it('phase sans rampe : renvoie targetKcal', () => {
    const p1 = phaseForCalendarWeek(plan, 1)!
    expect(kcalForWeek(plan, p1, 1)).toBe(2200)
    expect(kcalForWeek(plan, p1, 12)).toBe(2200)
    const p3 = phaseForCalendarWeek(plan, 29)!
    expect(kcalForWeek(plan, p3, 27)).toBe(2100)
    expect(kcalForWeek(plan, p3, 42)).toBe(2100)
  })

  it('phase 4 : rampe +100 kcal/sem de 2100 à 2550, puis plafond', () => {
    const p4 = phaseForCalendarWeek(plan, 45)!
    expect(kcalForWeek(plan, p4, 43)).toBe(2100) // N=1
    expect(kcalForWeek(plan, p4, 44)).toBe(2200) // N=2
    expect(kcalForWeek(plan, p4, 47)).toBe(2500) // N=5
    expect(kcalForWeek(plan, p4, 48)).toBe(2550) // N=6 → plafond
    expect(kcalForWeek(plan, p4, 60)).toBe(2550) // plafonné
  })
})
