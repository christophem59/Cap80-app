import type { Recommendation } from './types'
import type { WeeklyAvg } from './weight'
import { lossRate } from './weight'

/** Plancher dur : l'app refuse tout apport sous 1 800 kcal/j (§6.7). */
export const MIN_KCAL = 1800

export interface AdjustmentAdvice {
  recommendation: Recommendation
  /** Delta calorique quotidien proposé. */
  kcalDelta: number
  /** Alternative en pas quotidiens (proposée avec `decrease`). */
  stepDelta: number
  /** Perte hebdomadaire observée (kg/sem, positive = perte). */
  observedWeeklyLossKg: number
  weeksAnalysed: number
  /** true si `hold` mais avec avertissement (zone 0,30–0,40). */
  warning: boolean
  /** Raisonnement en une phrase (§7.7). */
  reason: string
}

export interface AdjustmentContext {
  /** Ancienneté de la phase en cours, en semaines. */
  phaseWeeksElapsed: number
  /** true une fois les 7 jours de pesée stricte terminés (§6.7, bascule vers diet_break). */
  strictLoggingCompleted?: boolean
}

/**
 * §6.7 — Règle d'ajustement. Évaluée sur la vitesse de perte (§6.5), donc jamais sur
 * moins de 3 semaines : renvoie null si `lossRate(3)` n'est pas calculable (refus dur,
 * critère d'acceptation §12.16).
 *
 * Ordre d'évaluation, la première ligne qui matche gagne :
 *   1. Plateau (|lossRate(4)| < 0,10 sur 4 semaines) → audit_journal
 *      (ou diet_break / decrease une fois la pesée stricte terminée) ;
 *   2. perte > 0,90            → increase (+150) ;
 *   3. 0,40 ≤ perte ≤ 0,90     → hold ;
 *   4. 0,30 ≤ perte < 0,40     → hold + avertissement ;
 *   5. perte < 0,30            → decrease (-100 kcal ou +2000 pas).
 */
export function recommendAdjustment(
  weekly: WeeklyAvg[],
  ctx: AdjustmentContext,
): AdjustmentAdvice | null {
  const lr3 = lossRate(weekly, 3)
  if (lr3 === null) return null // moins de 3 semaines → aucune reco

  const lr4 = lossRate(weekly, 4)
  const isPlateau = lr4 !== null && Math.abs(lr4) < 0.1

  if (isPlateau) {
    const observed = -lr4! // ≈ 0
    if (ctx.strictLoggingCompleted) {
      if (ctx.phaseWeeksElapsed >= 10) {
        return {
          recommendation: 'diet_break',
          kcalDelta: 0,
          stepDelta: 0,
          observedWeeklyLossKg: observed,
          weeksAnalysed: 4,
          warning: false,
          reason:
            'Plateau confirmé après une semaine de pesée stricte et une phase de plus de 10 semaines : une semaine à l’entretien relancera la perte mieux qu’une nouvelle coupe.',
        }
      }
      return {
        recommendation: 'decrease',
        kcalDelta: -100,
        stepDelta: 2000,
        observedWeeklyLossKg: observed,
        weeksAnalysed: 4,
        warning: false,
        reason:
          'Plateau confirmé après pesée stricte, mais la phase est récente (< 10 semaines) : on resserre légèrement plutôt que de faire une pause.',
      }
    }
    return {
      recommendation: 'audit_journal',
      kcalDelta: 0,
      stepDelta: 0,
      observedWeeklyLossKg: observed,
      weeksAnalysed: 4,
      warning: false,
      reason:
        'La perte est quasi nulle sur 4 semaines : la cause la plus fréquente est la sous-estimation de l’apport. Une pesée stricte de 7 jours avant de couper les calories.',
    }
  }

  const perte = -lr3 // kg/sem, positive quand il y a perte
  if (perte > 0.9) {
    return {
      recommendation: 'increase',
      kcalDelta: 150,
      stepDelta: 0,
      observedWeeklyLossKg: perte,
      weeksAnalysed: 3,
      warning: false,
      reason:
        'Perte trop rapide (> 0,9 kg/sem) : risque de perte musculaire, on remonte l’apport de 150 kcal/j.',
    }
  }
  if (perte >= 0.4) {
    return {
      recommendation: 'hold',
      kcalDelta: 0,
      stepDelta: 0,
      observedWeeklyLossKg: perte,
      weeksAnalysed: 3,
      warning: false,
      reason: 'Vitesse idéale (0,4–0,9 kg/sem) : ne rien changer.',
    }
  }
  if (perte >= 0.3) {
    return {
      recommendation: 'hold',
      kcalDelta: 0,
      stepDelta: 0,
      observedWeeklyLossKg: perte,
      weeksAnalysed: 3,
      warning: true,
      reason:
        'Perte un peu lente (0,3–0,4 kg/sem) : on maintient encore une semaine, mais on surveille.',
    }
  }
  return {
    recommendation: 'decrease',
    kcalDelta: -100,
    stepDelta: 2000,
    observedWeeklyLossKg: perte,
    weeksAnalysed: 3,
    warning: false,
    reason:
      'Perte trop lente (< 0,3 kg/sem) : couper 100 kcal/j ou ajouter 2 000 pas/j, au choix.',
  }
}

/**
 * Applique un delta calorique en respectant le plancher dur de 1 800 kcal (§6.7).
 * `floored` indique que la demande a été bloquée par le plancher.
 */
export function applyKcalDelta(
  currentKcal: number,
  delta: number,
): { kcal: number; floored: boolean } {
  const raw = currentKcal + delta
  if (raw < MIN_KCAL) return { kcal: MIN_KCAL, floored: true }
  return { kcal: raw, floored: false }
}
