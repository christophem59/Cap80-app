import { describe, it, expect } from 'vitest'
import type { BmrProfile, Phase } from './types'
import {
  observedEnergy,
  proposeActivityFactor,
  energyAlerts,
  energyTargets,
  proposePlanTargets,
  type WeekObservation,
} from './energy'

const profile = (activityFactor: number): BmrProfile => ({
  heightCm: 192,
  ageYears: 34,
  sex: 'male',
  activityFactor,
})

// Scénario de référence de tout le module : quatre semaines dont la perte (833 g/sem à
// ~2 285 kcal) est incompatible avec un facteur de 1,40. C'est le cas qui a motivé le
// §6.9 — un modèle qui se trompe de 400 kcal/jour pendant trois semaines sans rien dire.
const REEL: WeekObservation[] = [
  { week: 1, avgWeightKg: 98.9, avgIntakeKcal: 2280, estimated: true },
  { week: 2, avgWeightKg: 97.4, avgIntakeKcal: 2283 },
  { week: 3, avgWeightKg: 97.3, avgIntakeKcal: 2290, estimated: true },
  { week: 4, avgWeightKg: 96.4, avgIntakeKcal: 2289 },
]

describe('TDEE observé (§6.9)', () => {
  const o = observedEnergy(REEL, profile(1.4))!

  it('mesure la perte sur la fenêtre entière, pas semaine par semaine', () => {
    expect(o.weeks).toBe(4)
    expect(o.days).toBe(21)
    expect(o.lossKg).toBeCloseTo(2.5, 5)
  })

  it('retrouve la dépense réelle : ~3200 kcal, là où la théorie disait 2799', () => {
    expect(Math.round(o.tdeeKcal)).toBe(3204)
    expect(o.activityFactor).toBeCloseTo(1.6, 2)
  })

  it('n’intègre pas l’apport de la première semaine (antérieur à la variation)', () => {
    expect(Math.round(o.avgIntakeKcal)).toBe(2287)
  })

  it('exprime la vitesse en kg et en % du poids d’arrivée', () => {
    expect(o.weeklyLossKg).toBeCloseTo(0.8333, 3)
    expect(o.weeklyLossPct).toBeCloseTo(0.864, 2)
  })

  it('signale qu’une semaine retenue porte un apport estimé', () => {
    // S3 est estimée et fait partie des semaines « pendant » ; S1 ne compte pas.
    expect(o.estimated).toBe(true)
  })

  it('refuse toute estimation sous 3 semaines — une semaine isolée est absurde', () => {
    expect(observedEnergy(REEL.slice(-2), profile(1.4))).toBeNull()
    expect(observedEnergy([], profile(1.4))).toBeNull()
  })

  it('s’arrête à la première semaine sans apport saisi (fenêtre glissante)', () => {
    const trou: WeekObservation[] = [
      { week: 1, avgWeightKg: 98.9, avgIntakeKcal: 2280 },
      { week: 2, avgWeightKg: 97.4, avgIntakeKcal: null },
      { week: 3, avgWeightKg: 97.3, avgIntakeKcal: 2290 },
      { week: 4, avgWeightKg: 96.4, avgIntakeKcal: 2289 },
    ]
    expect(observedEnergy(trou, profile(1.4))).toBeNull()
  })
})

describe('proposition de facteur d’activité', () => {
  it('amortit : 1,40 face à un observé de 1,60 donne 1,55, pas 1,60', () => {
    expect(proposeActivityFactor(1.4, 1.603)).toBe(1.55)
  })

  it('ne propose rien tant que l’écart ne dépasse pas 0,10', () => {
    expect(proposeActivityFactor(1.55, 1.6)).toBeNull()
    expect(proposeActivityFactor(1.55, 1.5)).toBeNull()
  })

  it('fonctionne aussi à la baisse', () => {
    expect(proposeActivityFactor(1.6, 1.4)).toBe(1.45)
  })
})

describe('garde-fous (§6.9)', () => {
  it('sur les données réelles : dérive du modèle signalée, vitesse saine', () => {
    const o = observedEnergy(REEL, profile(1.4))!
    const kinds = energyAlerts(o, 1.4).map((a) => a.kind)
    expect(kinds).toEqual(['model_drift'])
  })

  it('se tait une fois le facteur recalé à 1,55', () => {
    const o = observedEnergy(REEL, profile(1.55))!
    expect(energyAlerts(o, 1.55)).toEqual([])
  })

  it('alerte au-delà de 1 % du poids corporel par semaine', () => {
    const rapide: WeekObservation[] = [
      { week: 1, avgWeightKg: 99.5, avgIntakeKcal: 2000 },
      { week: 2, avgWeightKg: 98.4, avgIntakeKcal: 2000 },
      { week: 3, avgWeightKg: 97.3, avgIntakeKcal: 2000 },
      { week: 4, avgWeightKg: 96.4, avgIntakeKcal: 2000 },
    ]
    const o = observedEnergy(rapide, profile(1.55))!
    expect(energyAlerts(o, 1.55).map((a) => a.kind)).toContain('loss_too_fast')
  })

  it('alerte aussi quand la perte est trop lente', () => {
    const lent: WeekObservation[] = [
      { week: 1, avgWeightKg: 96.8, avgIntakeKcal: 2500 },
      { week: 2, avgWeightKg: 96.7, avgIntakeKcal: 2500 },
      { week: 3, avgWeightKg: 96.6, avgIntakeKcal: 2500 },
      { week: 4, avgWeightKg: 96.5, avgIntakeKcal: 2500 },
    ]
    const o = observedEnergy(lent, profile(1.55))!
    expect(energyAlerts(o, 1.55).map((a) => a.kind)).toContain('loss_too_slow')
  })
})

describe('cibles dérivées (§6.9)', () => {
  const t = energyTargets(96.4, profile(1.55), 600)

  it('reproduit la table de référence du 18/09/2026', () => {
    expect(t.bmrKcal).toBe(1999)
    expect(t.tdeeKcal).toBe(3098)
    expect(t.intakeKcal).toBe(2500)
    expect(t.deficitKcal).toBe(598)
    expect(Math.round(t.expectedWeeklyLossKg * 1000)).toBe(544)
  })

  it('macros : 190 / 80 / 255 g, et les glucides bouclent l’apport', () => {
    expect(t.proteinG).toBe(190)
    expect(t.fatG).toBe(80)
    expect(t.carbsG).toBe(255)
    expect(t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4).toBe(t.intakeKcal)
  })

  it('expose les planchers durs : 1,6 g/kg de protéines, 0,7 g/kg de lipides', () => {
    expect(t.proteinFloorG).toBe(154)
    expect(t.fatFloorG).toBe(67)
    expect(t.proteinG).toBeGreaterThanOrEqual(t.proteinFloorG)
    expect(t.fatG).toBeGreaterThanOrEqual(t.fatFloorG)
  })

  it('l’ancien facteur 1,40 sous-estimait la dépense de 300 kcal/jour', () => {
    const avant = energyTargets(96.4, profile(1.4), 600)
    expect(avant.tdeeKcal).toBe(2799)
    expect(t.tdeeKcal - avant.tdeeKcal).toBe(299)
    // L'apport est arrondi à 50 kcal : 2 799 − 600 = 2 199 → 2 200.
    expect(avant.intakeKcal).toBe(2200)
  })

  it('ne descend jamais sous le plancher de 1 800 kcal (§6.7)', () => {
    const bride = energyTargets(60, profile(1.3), 900)
    expect(bride.intakeKcal).toBe(1800)
    expect(bride.floored).toBe(true)
  })
})

describe('cibles de toutes les phases (§6.9)', () => {
  const phases: Phase[] = [
    {
      id: 'p1', label: 'Phase 1', startCalendarWeek: 1, endCalendarWeek: 12, kind: 'deficit',
      targetKcal: 2200, proteinG: 180, fatG: 75, carbsG: 200, fiberMinG: 30,
      targetWeightAtEndKg: 93, workoutsPerWeek: 2, notes: '',
    },
    {
      id: 'break1', label: 'Pause 1', startCalendarWeek: 13, endCalendarWeek: 13, kind: 'maintenance',
      targetKcal: 2700, proteinG: 180, fatG: 90, carbsG: 292, fiberMinG: 30,
      targetWeightAtEndKg: 93, workoutsPerWeek: 2, notes: '',
    },
    {
      id: 'p2', label: 'Phase 2', startCalendarWeek: 14, endCalendarWeek: 27, kind: 'deficit',
      targetKcal: 2150, proteinG: 175, fatG: 72, carbsG: 200, fiberMinG: 30,
      targetWeightAtEndKg: 86, workoutsPerWeek: 2, notes: '',
    },
    {
      id: 'p4', label: 'Stabilisation', startCalendarWeek: 28, endCalendarWeek: null, kind: 'stabilisation',
      targetKcal: 2550, proteinG: 150, fatG: 85, carbsG: 296, fiberMinG: 30,
      ramp: { fromKcal: 2100, toKcal: 2550, stepPerWeek: 100 },
      targetWeightAtEndKg: 80, workoutsPerWeek: 2, notes: '',
    },
  ]
  const out = proposePlanTargets(phases, 'p1', 96.4, profile(1.55), 600)

  it('recalcule chaque phase au poids qu’elle verra, pas au poids d’aujourd’hui', () => {
    expect(out.map((p) => p.phaseId)).toEqual(['p1', 'break1', 'p2'])
    expect(out[0].weightKg).toBeCloseTo(96.4, 5)
    // 12 semaines de déficit plus tard, la phase 2 part d'un poids bien plus bas.
    expect(out[2].weightKg).toBeLessThan(91)
  })

  it('la phase en cours reçoit les cibles du jour : 2 500 kcal', () => {
    expect(out[0].targets.intakeKcal).toBe(2500)
    expect(out[0].changed).toBe(true)
  })

  it('une pause vise la dépense elle-même, sans déficit', () => {
    expect(out[1].targets.deficitKcal).toBeLessThanOrEqual(25)
    expect(out[1].targets.intakeKcal).toBeGreaterThan(out[0].targets.intakeKcal)
  })

  it('s’arrête à la phase à rampe : sa cible n’est pas un nombre', () => {
    expect(out.some((p) => p.phaseId === 'p4')).toBe(false)
  })

  it('ne propose rien pour les phases déjà passées', () => {
    expect(proposePlanTargets(phases, 'p2', 90, profile(1.55), 600).map((p) => p.phaseId)).toEqual(['p2'])
  })
})
