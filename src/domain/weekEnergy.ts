import type { LocalDate, MealLog, WeekOverride, WeightEntry } from './types'
import { calendarWeek } from './dates'
import type { WeekObservation } from './energy'

/**
 * Une semaine, telle que l'app la connaît : ce qu'elle a calculé, et ce que
 * l'utilisateur a éventuellement corrigé. On garde les compteurs de saisie parce que la
 * fiabilité d'une observation est une information : trois pesées ne valent pas sept.
 */
export interface WeekEnergyRow extends WeekObservation {
  weighIns: number
  loggedDays: number
  /** Valeurs calculées, conservées même quand une correction prend le dessus. */
  computedWeightKg: number | null
  computedIntakeKcal: number | null
  overridden: boolean
  note?: string
}

/** Pesées minimales pour qu'une moyenne hebdomadaire soit considérée exploitable (§6.4). */
export const MIN_WEIGH_INS = 4

/**
 * §6.9 — Reconstitue l'historique hebdomadaire à partir des données brutes.
 *
 * Deux sources, dans cet ordre : ce que l'app a enregistré, puis les corrections
 * manuelles. Les corrections existent parce que certaines semaines ne sont pas
 * mesurables — un forfait restaurant estimé à 1 500 kcal quand la réalité était 1 200
 * fausse le TDEE observé de 40 kcal/jour, et l'app n'a aucun moyen de le deviner.
 *
 * Une semaine sans apport exploitable porte `avgIntakeKcal: null` : elle coupe la
 * fenêtre d'observation au lieu de la polluer.
 */
export function buildWeekEnergyRows(
  weights: WeightEntry[],
  meals: MealLog[],
  startDate: LocalDate,
  overrides: WeekOverride[] = [],
): WeekEnergyRow[] {
  const weightsByWeek = new Map<number, number[]>()
  for (const w of weights) {
    if (w.deletedAt) continue
    const week = calendarWeek(startDate, w.date)
    weightsByWeek.set(week, [...(weightsByWeek.get(week) ?? []), w.weightKg])
  }

  // Un jour compte comme saisi dès qu'il porte au moins un item : un jour vide est un
  // jour non renseigné, pas un jour à 0 kcal (qui écraserait la moyenne).
  const kcalByDay = new Map<string, number>()
  for (const m of meals) {
    if (m.deletedAt || m.items.length === 0) continue
    const sum = m.items.reduce((s, it) => s + it.kcal, 0)
    kcalByDay.set(m.date, (kcalByDay.get(m.date) ?? 0) + sum)
  }
  const intakeByWeek = new Map<number, number[]>()
  for (const [date, kcal] of kcalByDay) {
    const week = calendarWeek(startDate, date)
    intakeByWeek.set(week, [...(intakeByWeek.get(week) ?? []), kcal])
  }

  const overrideByWeek = new Map(overrides.map((o) => [o.week, o]))
  const weeks = new Set<number>([
    ...weightsByWeek.keys(),
    ...intakeByWeek.keys(),
    ...overrideByWeek.keys(),
  ])

  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

  const rows: WeekEnergyRow[] = []
  for (const week of [...weeks].sort((a, b) => a - b)) {
    const ws = weightsByWeek.get(week) ?? []
    const ks = intakeByWeek.get(week) ?? []
    const ov = overrideByWeek.get(week)

    const computedWeightKg = ws.length ? avg(ws) : null
    const computedIntakeKcal = ks.length ? avg(ks) : null
    const avgWeightKg = ov?.avgWeightKg ?? computedWeightKg
    if (avgWeightKg == null) continue // sans poids, la semaine n'apprend rien

    rows.push({
      week,
      avgWeightKg,
      avgIntakeKcal: ov?.avgIntakeKcal ?? computedIntakeKcal,
      // Une semaine partiellement saisie est une estimation, qu'on le dise ou non.
      estimated: ov?.estimated ?? (computedIntakeKcal != null && ks.length < 6),
      weighIns: ws.length,
      loggedDays: ks.length,
      computedWeightKg,
      computedIntakeKcal,
      overridden: ov != null,
      ...(ov?.note ? { note: ov.note } : {}),
    })
  }
  return rows
}
