import { describe, it, expect } from 'vitest'
import type { Plan } from './types'
import { adjustPlanKcal, adjustPlanSteps } from './planEdit'
import { defaultPlan } from '../data/catalog'

const plan = defaultPlan as Plan

describe('adjustPlanKcal (§6.7)', () => {
  it('applique le delta à la phase en cours et aux suivantes, pas aux précédentes', () => {
    const out = adjustPlanKcal(plan, 'p2', -100)
    const byId = (p: Plan, id: string) => p.phases.find((x) => x.id === id)!
    expect(byId(out, 'p1').targetKcal).toBe(byId(plan, 'p1').targetKcal) // avant : inchangé
    expect(byId(out, 'p2').targetKcal!).toBe(byId(plan, 'p2').targetKcal! - 100)
    expect(byId(out, 'p3').targetKcal!).toBe(byId(plan, 'p3').targetKcal! - 100)
  })
  it('respecte le plancher de 1 800 kcal', () => {
    const out = adjustPlanKcal(plan, 'p1', -1000)
    expect(out.phases.find((p) => p.id === 'p1')!.targetKcal).toBe(1800)
  })
  it('décale la rampe de la stabilisation', () => {
    const out = adjustPlanKcal(plan, 'p3', -100)
    const p4 = out.phases.find((p) => p.id === 'p4')!
    expect(p4.ramp!.fromKcal).toBe(2000)
    expect(p4.ramp!.toKcal).toBe(2450)
  })
})

describe('adjustPlanSteps', () => {
  it('ajoute le delta de pas à la phase en cours et aux suivantes', () => {
    const out = adjustPlanSteps(plan, 'p2', 2000)
    expect(out.stepGoals['p2']).toBe(plan.stepGoals['p2'] + 2000)
    expect(out.stepGoals['p1']).toBe(plan.stepGoals['p1'])
  })
})
