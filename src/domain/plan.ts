import type { Plan, Phase } from './types'

// ⚠️ Les deux numérotations de semaines (§6.6) — le piège central du projet.
//
//  - calendarWeek : la semaine réellement vécue, PAUSES INCLUSES. Sert à savoir
//    dans quelle phase on est aujourd'hui. Va de 1 à 44 (0 = calibrage).
//  - deficitWeek  : le compteur des SEULES semaines en déficit, pauses EXCLUES.
//    Sert au graphique de trajectoire et à la simulation. Va de 1 à 42.
//
// Une « pause » est une phase de kind 'maintenance'. Ces semaines n'ont pas de
// deficitWeek et décalent les semaines suivantes dans le calendrier réel.

/** Phase couvrant une semaine calendaire donnée, ou null si aucune. */
export function phaseForCalendarWeek(plan: Plan, cw: number): Phase | null {
  for (const p of plan.phases) {
    const end = p.endCalendarWeek ?? Infinity
    if (cw >= p.startCalendarWeek && cw <= end) return p
  }
  return null
}

/** true si la semaine calendaire est une pause (phase de maintenance). */
export function isPauseWeek(plan: Plan, cw: number): boolean {
  return phaseForCalendarWeek(plan, cw)?.kind === 'maintenance'
}

/**
 * deficitWeek → calendarWeek : on avance dans le calendrier en sautant les pauses
 * et en comptant les semaines en déficit jusqu'à atteindre `deficitWeek`.
 */
export function calendarWeekFromDeficitWeek(plan: Plan, deficitWeek: number): number {
  if (deficitWeek < 1) throw new Error(`deficitWeek doit être ≥ 1 (reçu ${deficitWeek})`)
  let count = 0
  // Borne de sécurité large pour ne jamais boucler indéfiniment.
  for (let cw = 1; cw <= 10_000; cw++) {
    if (!isPauseWeek(plan, cw)) {
      count++
      if (count === deficitWeek) return cw
    }
  }
  throw new Error(`deficitWeek ${deficitWeek} hors de portée du plan`)
}

/**
 * calendarWeek → deficitWeek : nombre de semaines en déficit (pauses exclues) dans
 * [1..cw]. Renvoie null si la semaine est une pause ou est antérieure à la semaine 1
 * (calibrage).
 */
export function deficitWeekFromCalendarWeek(plan: Plan, cw: number): number | null {
  if (cw < 1 || isPauseWeek(plan, cw)) return null
  let count = 0
  for (let w = 1; w <= cw; w++) {
    if (!isPauseWeek(plan, w)) count++
  }
  return count
}

/** Première deficitWeek d'une phase (utile au calcul de la rampe). */
export function firstDeficitWeekOfPhase(plan: Plan, phase: Phase): number {
  const dw = deficitWeekFromCalendarWeek(plan, phase.startCalendarWeek)
  if (dw === null) {
    throw new Error(`La phase ${phase.id} ne commence pas sur une semaine en déficit`)
  }
  return dw
}

/**
 * Apport calorique cible d'une deficitWeek au sein de sa phase.
 * Si la phase porte une rampe, l'apport de sa N-ième semaine vaut
 * min(toKcal, fromKcal + stepPerWeek * (N - 1)) et prend le pas sur targetKcal.
 */
export function kcalForWeek(plan: Plan, phase: Phase, deficitWeek: number): number {
  if (phase.ramp) {
    const n = deficitWeek - firstDeficitWeekOfPhase(plan, phase) + 1
    const { fromKcal, toKcal, stepPerWeek } = phase.ramp
    return Math.min(toKcal, fromKcal + stepPerWeek * (n - 1))
  }
  if (phase.targetKcal === null) {
    throw new Error(`La phase ${phase.id} n'a pas de cible calorique (calibrage ?)`)
  }
  return phase.targetKcal
}
