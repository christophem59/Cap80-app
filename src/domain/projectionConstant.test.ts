import { describe, it, expect } from 'vitest'
import type { BmrProfile } from './types'
import { projectAtConstantIntake, weeksToReach } from './projection'

const profile: BmrProfile = {
  heightCm: 192,
  ageYears: 34,
  sex: 'male',
  activityFactor: 1.55,
}

// Trajectoire de référence du 18/09/2026 : 96,4 kg à 2 500 kcal, facteur 1,55.
const points = projectAtConstantIntake(96.4, 2500, profile, 60)
const round1 = (x: number) => Math.round(x * 10) / 10

describe('projection à apport constant (§6.9)', () => {
  it('le point 0 décrit aujourd’hui : 3 098 kcal de dépense, 598 de déficit', () => {
    expect(points[0]).toMatchObject({ week: 0, bmrKcal: 1999, tdeeKcal: 3098, deficitKcal: 598 })
    expect(round1(points[0].weightKg)).toBe(96.4)
  })

  it('reproduit la table de référence, tous les 4 semaines', () => {
    expect(round1(points[4].weightKg)).toBe(94.3)
    expect(round1(points[8].weightKg)).toBe(92.3)
    expect(round1(points[12].weightKg)).toBe(90.4)
    expect(round1(points[20].weightKg)).toBe(86.9)
    expect(round1(points[28].weightKg)).toBe(83.7)
    expect(round1(points[36].weightKg)).toBe(81.0)
  })

  it('la perte RALENTIT : 544 g la première semaine, 326 g la trente-septième', () => {
    expect(Math.round(points[0].lossKg * 1000)).toBe(544)
    expect(Math.round(points[36].lossKg * 1000)).toBe(326)
  })

  it('80 kg atteints en 39 semaines — pas les 34 qu’annoncerait une droite', () => {
    expect(weeksToReach(points, 80)).toBe(39)
    // Projection linéaire naïve : 16,4 kg à 544 g/sem = 30 semaines. L'écart est le sujet.
    expect(Math.ceil(16.4 / 0.544)).toBeLessThan(39)
  })

  it('renvoie null quand la cible est hors de portée de la fenêtre', () => {
    expect(weeksToReach(points, 50)).toBeNull()
  })
})
