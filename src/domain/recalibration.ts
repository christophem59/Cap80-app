import type { Plan, Profile } from './types'
import { bmr } from './metabolism'
import { setPhaseTargets } from './planEdit'
import { proposePlanTargets, DEFAULT_TARGET_DEFICIT_KCAL } from './energy'
import { ageFromBirthYear, calendarWeek } from './dates'
import { phaseForCalendarWeek } from './plan'

// Recalibrages DÉCIDÉS, appliqués une fois et une seule.
//
// Un recalibrage n'est pas une préférence : c'est une correction d'un modèle dont on a
// mesuré qu'il se trompait. Le laisser derrière un bouton revient à ne pas le faire —
// l'app continuerait à afficher des cibles qu'on sait fausses en attendant un tap.
//
// Chacun porte un identifiant et se retrouve dans l'historique du facteur : on peut
// toujours revenir en arrière, mais pas passer à côté sans le savoir.

export interface Recalibration {
  id: string
  date: string
  toFactor: number
  reason: string
  /** Facteur mesuré qui a motivé la décision, quand il était connu. */
  observedFactor?: number
}

/**
 * Le recalibrage du 18/09/2026.
 *
 * Quatre moyennes hebdomadaires, 2,5 kg perdus en 21 jours à ~2 285 kcal/jour :
 * dépense réelle ≈ 3 200 kcal, soit un facteur de 1,60 — là où le modèle en place, à
 * 1,40, annonçait 2 800. Un écart de 400 kcal/jour, systématique sur trois semaines.
 * On retient 1,55 et non 1,60 : trois semaines restent trois semaines.
 */
export const RECALIBRATIONS: Recalibration[] = [
  {
    id: '2026-09-18-facteur-155',
    date: '2026-09-18',
    toFactor: 1.55,
    observedFactor: 1.6,
    reason:
      'Recalibrage du 18/09/2026 : sur 3 semaines, la dépense observée (~3 200 kcal) impliquait un facteur de 1,60, contre 1,40 en place — 400 kcal/jour d’écart systématique. Retenu 1,55 par prudence, à réévaluer chaque vendredi.',
  },
]

/**
 * Recalibrage restant à appliquer, ou null. On ne touche à rien tant que l'onboarding
 * n'est pas validé (le profil est encore un placeholder), ni si le facteur a DÉJÀ été
 * recalé — à la main ou par un recalibrage antérieur : la décision de l'utilisateur
 * prime toujours sur une décision datée du code.
 */
export function pendingRecalibration(profile: Profile): Recalibration | null {
  if (!profile.onboarded) return null
  const history = profile.activityFactorHistory ?? []
  if (history.length > 0) return null
  return RECALIBRATIONS.find((r) => profile.activityFactor < r.toFactor) ?? null
}

/**
 * Applique un recalibrage : le facteur, son historisation, et les cibles de toutes les
 * phases à venir recalculées au poids qu'elles verront vraiment.
 *
 * Recaler le facteur SANS toucher aux phases serait pire que ne rien faire : la dépense
 * affichée grimperait de 300 kcal pendant que les cibles resteraient celles de l'ancien
 * modèle, creusant un déficit que personne n'a voulu.
 */
export function applyRecalibration(
  profile: Profile,
  recal: Recalibration,
  refWeightKg: number,
  today: string,
): Profile {
  const bmrProfile = {
    heightCm: profile.heightCm,
    ageYears: ageFromBirthYear(profile.birthYear, Number(today.slice(0, 4))),
    sex: profile.sex,
    activityFactor: recal.toFactor,
  }
  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)

  let plan: Plan = profile.plan
  if (phase) {
    const proposals = proposePlanTargets(
      profile.plan.phases,
      phase.id,
      refWeightKg,
      bmrProfile,
      profile.targetDeficitKcal ?? DEFAULT_TARGET_DEFICIT_KCAL,
    )
    plan = proposals.reduce(
      (p, pr) =>
        setPhaseTargets(p, pr.phaseId, {
          kcal: pr.targets.intakeKcal,
          proteinG: pr.targets.proteinG,
          fatG: pr.targets.fatG,
          carbsG: pr.targets.carbsG,
          fiberMinG: pr.targets.fiberMinG,
        }),
      plan,
    )
  }

  return {
    ...profile,
    activityFactor: recal.toFactor,
    plan,
    activityFactorHistory: [
      ...(profile.activityFactorHistory ?? []),
      {
        date: recal.date,
        from: profile.activityFactor,
        to: recal.toFactor,
        ...(recal.observedFactor != null ? { observedFactor: recal.observedFactor } : {}),
        reason: recal.reason,
      },
    ],
  }
}

/** Dépense théorique avant/après, pour dire à l'utilisateur ce qui vient de changer. */
export function recalibrationSummary(
  before: Profile,
  after: Profile,
  refWeightKg: number,
  today: string,
): { fromKcal: number; toKcal: number; phaseLabel: string | null; phaseKcal: number | null } {
  const b = bmr(
    refWeightKg,
    before.heightCm,
    ageFromBirthYear(before.birthYear, Number(today.slice(0, 4))),
    before.sex,
  )
  const week = calendarWeek(after.startDate, today)
  const phase = phaseForCalendarWeek(after.plan, week)
  return {
    fromKcal: Math.round(b * before.activityFactor),
    toKcal: Math.round(b * after.activityFactor),
    phaseLabel: phase?.label ?? null,
    phaseKcal: phase?.targetKcal ?? null,
  }
}
