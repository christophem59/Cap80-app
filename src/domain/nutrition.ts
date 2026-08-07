import type { MealItem, Phase } from './types'

export type MacroStatus = 'ok' | 'under' | 'over' | 'none'

export interface MacroLine {
  value: number
  target: number | null
  /** value - target (signé). null si pas de cible. Affiché en valeur absolue par l'UI. */
  diff: number | null
  status: MacroStatus
}

export interface DailyTotals {
  kcal: MacroLine
  proteinG: MacroLine
  fatG: MacroLine
  carbsG: MacroLine
  fiberG: MacroLine
}

/** Plafond indicatif : ok tant qu'on ne dépasse pas la cible. */
function ceilingLine(value: number, target: number | null): MacroLine {
  if (target === null) return { value, target: null, diff: null, status: 'none' }
  return { value, target, diff: value - target, status: value <= target ? 'ok' : 'over' }
}

/** Cible à atteindre ou dépasser (protéines, fibres). */
function floorLine(value: number, target: number | null): MacroLine {
  if (target === null) return { value, target: null, diff: null, status: 'none' }
  return { value, target, diff: value - target, status: value >= target ? 'ok' : 'under' }
}

/**
 * §6.8 — Totaux du jour comparés aux cibles de la phase. La cible protéines a un
 * statut particulier : c'est la seule à ATTEINDRE OU DÉPASSER ; les fibres ont un
 * minimum ; kcal / lipides / glucides sont des plafonds indicatifs.
 */
export function dailyTotals(items: MealItem[], phase: Phase): DailyTotals {
  const sum = items.reduce(
    (s, it) => ({
      kcal: s.kcal + it.kcal,
      proteinG: s.proteinG + it.proteinG,
      fatG: s.fatG + it.fatG,
      carbsG: s.carbsG + it.carbsG,
      fiberG: s.fiberG + it.fiberG,
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 },
  )
  return {
    kcal: ceilingLine(sum.kcal, phase.targetKcal),
    proteinG: floorLine(sum.proteinG, phase.proteinG),
    fatG: ceilingLine(sum.fatG, phase.fatG),
    carbsG: ceilingLine(sum.carbsG, phase.carbsG),
    fiberG: floorLine(sum.fiberG, phase.fiberMinG),
  }
}
