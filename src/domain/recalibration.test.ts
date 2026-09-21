import { describe, it, expect } from 'vitest'
import type { Profile, Plan } from './types'
import { defaultPlan } from '../data/catalog'
import {
  RECALIBRATIONS,
  pendingRecalibration,
  applyRecalibration,
  recalibrationSummary,
} from './recalibration'

const recal = RECALIBRATIONS[0]
const base: Profile = {
  heightCm: 192,
  birthYear: 1992,
  sex: 'male',
  startWeightKg: 98.9,
  targetWeightKg: 80,
  activityFactor: 1.4,
  startDate: '2026-08-24',
  plan: defaultPlan as Plan,
  onboarded: true,
  updatedAt: '2026-09-18T06:00:00.000Z',
}

describe('recalibrage du modèle — à qui il s’applique', () => {
  it('s’applique à un profil encore sur l’ancien facteur', () => {
    expect(pendingRecalibration(base)?.id).toBe(recal.id)
  })

  it('ne touche pas un profil qui n’a pas validé l’onboarding (c’est un placeholder)', () => {
    expect(pendingRecalibration({ ...base, onboarded: false })).toBeNull()
  })

  it('ne se réapplique jamais une deuxième fois', () => {
    const after = applyRecalibration(base, recal, 96.4, '2026-09-18')
    expect(pendingRecalibration(after)).toBeNull()
  })

  it('respecte une décision de l’utilisateur : un facteur déjà recalé à la main prime', () => {
    const manuel: Profile = {
      ...base,
      activityFactor: 1.45,
      activityFactorHistory: [
        { date: '2026-09-10', from: 1.4, to: 1.45, reason: 'reprise du vélo' },
      ],
    }
    expect(pendingRecalibration(manuel)).toBeNull()
  })

  it('ne redescend pas quelqu’un déjà au-dessus de la cible', () => {
    expect(pendingRecalibration({ ...base, activityFactor: 1.6 })).toBeNull()
  })

  it('ne s’applique pas à un programme démarré APRÈS la décision', () => {
    // Une réinstallation avec un programme neuf choisit son niveau d'activité à
    // l'onboarding : lui plaquer 1,55, conclusion tirée de semaines qui n'ont jamais eu
    // lieu pour ce programme, écraserait ce choix.
    expect(pendingRecalibration({ ...base, startDate: '2026-10-05' })).toBeNull()
    expect(pendingRecalibration({ ...base, startDate: recal.date })).toBeNull()
  })
})

describe('recalibrage du modèle — ce qu’il change', () => {
  const after = applyRecalibration(base, recal, 96.4, '2026-09-18')

  it('porte le facteur à 1,55 et l’inscrit dans l’historique, avec sa raison', () => {
    expect(after.activityFactor).toBe(1.55)
    expect(after.activityFactorHistory).toHaveLength(1)
    expect(after.activityFactorHistory![0]).toMatchObject({
      from: 1.4,
      to: 1.55,
      observedFactor: 1.6,
      date: '2026-09-18',
    })
    expect(after.activityFactorHistory![0].reason).toContain('1,60')
  })

  it('recalcule la phase en cours : 2 500 kcal, 190 / 80 / 255 g', () => {
    const p1 = after.plan.phases.find((p) => p.id === 'p1')!
    expect(p1.targetKcal).toBe(2500)
    expect([p1.proteinG, p1.fatG, p1.carbsG]).toEqual([190, 80, 255])
  })

  it('recalcule AUSSI les phases suivantes — sinon le déficit de la phase 2 explose', () => {
    const p2 = after.plan.phases.find((p) => p.id === 'p2')!
    const avant = (defaultPlan as Plan).phases.find((p) => p.id === 'p2')!
    expect(p2.targetKcal).toBeGreaterThan(avant.targetKcal!)
  })

  it('laisse la rampe de stabilisation intacte : ce n’est pas une cible chiffrée', () => {
    const p4 = after.plan.phases.find((p) => p.id === 'p4')!
    expect(p4.ramp).toEqual((defaultPlan as Plan).phases.find((p) => p.id === 'p4')!.ramp)
  })

  it('résume le changement en kcal pour pouvoir l’annoncer', () => {
    const s = recalibrationSummary(base, after, 96.4, '2026-09-18')
    expect(s).toMatchObject({ fromKcal: 2799, toKcal: 3098, phaseKcal: 2500 })
    expect(s.phaseLabel).toContain('Phase 1')
  })
})
