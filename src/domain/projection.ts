import type { BmrProfile, Plan } from './types'
import { tdee } from './metabolism'
import {
  calendarWeekFromDeficitWeek,
  phaseForCalendarWeek,
  kcalForWeek,
} from './plan'

/** 1 kg de masse ≈ 7700 kcal (§6.6). */
export const KCAL_PER_KG = 7700

export interface ProjectionPoint {
  deficitWeek: number
  calendarWeek: number
  weightKg: number
}

/**
 * §6.6 — Projection semaine par semaine, avec recalcul de la dépense à chaque
 * itération. C'est l'algorithme qui a produit la courbe du programme papier.
 *
 * L'indice de boucle est un deficitWeek ; on passe OBLIGATOIREMENT par la conversion
 * vers calendarWeek pour trouver la phase (sinon S40 = 80,6 au lieu de 79,8). Les
 * semaines de pause n'apparaissent pas ici : elles n'ont pas de deficitWeek.
 */
export function projectTrajectory(
  startWeightKg: number,
  plan: Plan,
  profile: BmrProfile,
  deficitWeeks: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  let w = startWeightKg
  for (let d = 1; d <= deficitWeeks; d++) {
    const cw = calendarWeekFromDeficitWeek(plan, d)
    const phase = phaseForCalendarWeek(plan, cw)
    if (!phase) throw new Error(`Aucune phase pour la semaine calendaire ${cw}`)
    const intake = kcalForWeek(plan, phase, d)
    const deficit = tdee(w, profile) - intake
    w = w - (deficit * 7) / KCAL_PER_KG
    points.push({ deficitWeek: d, calendarWeek: cw, weightKg: w })
  }
  return points
}

/** Première deficitWeek où la moyenne projetée passe sous `targetKg`, ou null. */
export function weekCrossingTarget(
  points: ProjectionPoint[],
  targetKg: number,
): number | null {
  const hit = points.find((p) => p.weightKg <= targetKg)
  return hit ? hit.deficitWeek : null
}
