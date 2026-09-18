import type { BmrProfile, Plan } from './types'
import { bmr, tdee } from './metabolism'
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

/** Un pas de la projection à apport constant (§6.9). */
export interface ConstantIntakePoint {
  /** Semaines écoulées depuis le départ. Le point 0 décrit la situation d'aujourd'hui. */
  week: number
  /** Poids au DÉBUT de cette semaine. */
  weightKg: number
  bmrKcal: number
  tdeeKcal: number
  deficitKcal: number
  /** Perte attendue PENDANT cette semaine. */
  lossKg: number
}

/**
 * §6.9 — Projection à apport constant, sans phases.
 *
 * À apport constant la perte RALENTIT mécaniquement : le poids baisse, donc le BMR
 * baisse, donc le déficit se réduit. Une projection linéaire surestime toujours le
 * résultat — d'où cette itération semaine par semaine, qui recalcule la dépense à chaque
 * pas. C'est le même principe que §6.6, mais appliqué à un apport unique plutôt qu'au
 * programme : il répond à « et si je reste à 2 500 kcal ? ».
 */
export function projectAtConstantIntake(
  startWeightKg: number,
  intakeKcal: number,
  profile: BmrProfile,
  weeks: number,
): ConstantIntakePoint[] {
  const points: ConstantIntakePoint[] = []
  let w = startWeightKg
  for (let i = 0; i <= weeks; i++) {
    const bmrKcal = bmr(w, profile.heightCm, profile.ageYears, profile.sex)
    const tdeeKcal = tdee(w, profile)
    const deficitKcal = tdeeKcal - intakeKcal
    const lossKg = (deficitKcal * 7) / KCAL_PER_KG
    points.push({ week: i, weightKg: w, bmrKcal, tdeeKcal, deficitKcal, lossKg })
    w = w - lossKg
  }
  return points
}

/** Première semaine où le poids projeté atteint `targetKg`, ou null hors de portée. */
export function weeksToReach(
  points: ConstantIntakePoint[],
  targetKg: number,
): number | null {
  const hit = points.find((p) => p.weightKg <= targetKg)
  return hit ? hit.week : null
}
