import type { Plan, Phase } from './types'
import { MIN_KCAL } from './adjustment'

// Transformations pures du Plan (§6.7 : appliquer un ajustement modifie la phase en
// cours ET les suivantes). Le plancher dur de 1 800 kcal est toujours respecté.

function floor(kcal: number): number {
  return Math.max(MIN_KCAL, kcal)
}

/** Phases à partir de `fromPhaseId` incluse (par ordre de semaine calendaire). */
function fromPhase(plan: Plan, fromPhaseId: string): Set<string> {
  const ordered = [...plan.phases].sort((a, b) => a.startCalendarWeek - b.startCalendarWeek)
  const idx = ordered.findIndex((p) => p.id === fromPhaseId)
  return new Set(idx < 0 ? [] : ordered.slice(idx).map((p) => p.id))
}

/** Applique un delta calorique à la phase en cours et aux suivantes (plancher 1 800). */
export function adjustPlanKcal(plan: Plan, fromPhaseId: string, delta: number): Plan {
  const targets = fromPhase(plan, fromPhaseId)
  const phases = plan.phases.map((p): Phase => {
    if (!targets.has(p.id)) return p
    if (p.ramp) {
      return {
        ...p,
        ramp: {
          ...p.ramp,
          fromKcal: floor(p.ramp.fromKcal + delta),
          toKcal: floor(p.ramp.toKcal + delta),
        },
      }
    }
    if (p.targetKcal == null) return p // calibrage : pas de cible à ajuster
    return { ...p, targetKcal: floor(p.targetKcal + delta) }
  })
  return { ...plan, phases }
}

/** Applique un delta de pas quotidiens à la phase en cours et aux suivantes. */
export function adjustPlanSteps(plan: Plan, fromPhaseId: string, delta: number): Plan {
  const targets = fromPhase(plan, fromPhaseId)
  const stepGoals = { ...plan.stepGoals }
  for (const id of targets) {
    stepGoals[id] = Math.max(0, (stepGoals[id] ?? 0) + delta)
  }
  return { ...plan, stepGoals }
}
