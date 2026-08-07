import type { BmrProfile, Sex } from './types'

/**
 * §6.1 — Métabolisme de base, formule de Mifflin-St Jeor.
 * bmr = 10*poids + 6.25*taille - 5*âge + (5 homme | -161 femme)
 */
export function bmr(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex = 'male',
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return base + (sex === 'male' ? 5 : -161)
}

/**
 * §6.2 — Dépense énergétique totale = round(bmr * facteur d'activité).
 * L'arrondi fait partie de la définition : la projection (§6.6) s'appuie dessus.
 */
export function tdee(weightKg: number, p: BmrProfile): number {
  return Math.round(bmr(weightKg, p.heightCm, p.ageYears, p.sex) * p.activityFactor)
}
