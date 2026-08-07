import type { WeightEntry, LocalDate } from './types'
import { addDays, daysBetween, calendarWeek } from './dates'

/** Moyenne d'une semaine de programme (§6.4 / §6.5). */
export interface WeeklyAvg {
  week: number // calendarWeek
  avg: number
  count: number
}

/** Pesées vivantes (tombstones exclus), triées par date croissante. */
function livingSorted(entries: WeightEntry[]): WeightEntry[] {
  return entries
    .filter((e) => !e.deletedAt)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * §6.4 — Moyenne mobile du poids sur `window` jours, se terminant à `date`
 * (fenêtre [date-6j ; date] pour window=7). Jours manquants ignorés.
 * Exige AU MOINS 4 pesées dans la fenêtre, sinon null (« pas assez de données »).
 */
export function trailingAvg(
  entries: WeightEntry[],
  date: LocalDate,
  window = 7,
): number | null {
  const from = addDays(date, -(window - 1))
  const inWindow = entries.filter(
    (e) =>
      !e.deletedAt &&
      daysBetween(from, e.date) >= 0 &&
      daysBetween(e.date, date) >= 0,
  )
  if (inWindow.length < 4) return null
  const sum = inWindow.reduce((s, e) => s + e.weightKg, 0)
  return sum / inWindow.length
}

/**
 * Moyennes hebdomadaires (une valeur par semaine de programme). `minCount` fixe le
 * nombre minimal de pesées pour qu'une semaine soit retenue (une semaine « complète »
 * au sens du §6.5 en demande 4). Trié par numéro de semaine croissant.
 */
export function weeklyAverages(
  entries: WeightEntry[],
  startDate: LocalDate,
  minCount = 1,
): WeeklyAvg[] {
  const buckets = new Map<number, number[]>()
  for (const e of livingSorted(entries)) {
    const w = calendarWeek(startDate, e.date)
    const arr = buckets.get(w) ?? []
    arr.push(e.weightKg)
    buckets.set(w, arr)
  }
  const out: WeeklyAvg[] = []
  for (const [week, vals] of buckets) {
    if (vals.length < minCount) continue
    out.push({
      week,
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    })
  }
  return out.sort((a, b) => a.week - b.week)
}

/**
 * §6.5 — Vitesse de perte : régression linéaire des moindres carrés sur les `weeks`
 * dernières moyennes hebdomadaires disponibles. Renvoie la pente en kg/semaine,
 * NÉGATIVE quand il y a perte. null si le nombre de semaines disponibles est
 * insuffisant. Une régression, pas une simple différence première/dernière semaine :
 * plus robuste à une semaine de rétention d'eau isolée.
 */
export function lossRate(weekly: WeeklyAvg[], weeks: 3 | 4 | 6): number | null {
  if (weekly.length < weeks) return null
  const window = weekly.slice(-weeks)
  const n = window.length
  const meanX = window.reduce((s, p) => s + p.week, 0) / n
  const meanY = window.reduce((s, p) => s + p.avg, 0) / n
  let num = 0
  let den = 0
  for (const p of window) {
    const dx = p.week - meanX
    num += dx * (p.avg - meanY)
    den += dx * dx
  }
  if (den === 0) return null
  return num / den
}
