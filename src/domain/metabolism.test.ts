import { describe, it, expect } from 'vitest'
import { bmr, tdee } from './metabolism'
import type { BmrProfile } from './types'

// Profil de référence du CDC : 1,92 m, 34 ans, homme, facteur 1,40.
const H = 192
const AGE = 34
const profile: BmrProfile = {
  heightCm: H,
  ageYears: AGE,
  sex: 'male',
  activityFactor: 1.4,
}

describe('bmr (§6.1) — valeurs de référence', () => {
  it.each([
    [100, 2035],
    [95, 1985],
    [90, 1935],
    [85, 1885],
    [80, 1835],
  ])('%i kg → %i kcal', (w, expected) => {
    expect(bmr(w, H, AGE)).toBe(expected)
  })

  it('femme : -161 au lieu de +5', () => {
    expect(bmr(100, H, AGE, 'female')).toBe(2035 - 5 - 161)
  })
})

describe('tdee (§6.2) — valeurs de référence (facteur 1,40)', () => {
  it.each([
    [100, 2849],
    [90, 2709],
    [80, 2569],
  ])('%i kg → %i kcal', (w, expected) => {
    expect(tdee(w, profile)).toBe(expected)
  })
})
