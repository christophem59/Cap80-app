import { describe, it, expect } from 'vitest'
import type { Plan } from './types'
import { adjustPlanKcal, adjustPlanSteps, setPhaseTargets } from './planEdit'
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

describe('setPhaseTargets (§6.9)', () => {
  const targets = { kcal: 2500, proteinG: 190, fatG: 80, carbsG: 255, fiberMinG: 30 }

  it('écrit les cibles calculées dans la phase visée, et seulement elle', () => {
    const out = setPhaseTargets(plan, 'p1', targets)
    expect(out.phases.find((p) => p.id === 'p1')).toMatchObject({
      targetKcal: 2500,
      proteinG: 190,
      fatG: 80,
      carbsG: 255,
    })
    // Les phases suivantes seront recalculées à un poids qu'on ne connaît pas encore.
    expect(out.phases.find((p) => p.id === 'p2')!.targetKcal).toBe(
      plan.phases.find((p) => p.id === 'p2')!.targetKcal,
    )
  })

  it('respecte le plancher de 1 800 kcal', () => {
    const out = setPhaseTargets(plan, 'p1', { ...targets, kcal: 1500 })
    expect(out.phases.find((p) => p.id === 'p1')!.targetKcal).toBe(1800)
  })

  it('ne touche ni au calibrage ni à une phase à rampe : leur cible n’est pas un nombre', () => {
    expect(setPhaseTargets(plan, 'p0', targets).phases.find((p) => p.id === 'p0')!.targetKcal).toBeNull()
    const p4 = setPhaseTargets(plan, 'p4', targets).phases.find((p) => p.id === 'p4')!
    expect(p4.ramp).toEqual(plan.phases.find((p) => p.id === 'p4')!.ramp)
    expect(p4.targetKcal).toBe(plan.phases.find((p) => p.id === 'p4')!.targetKcal)
  })
})
