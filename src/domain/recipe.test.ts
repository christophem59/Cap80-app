import { describe, it, expect } from 'vitest'
import type { Food } from './types'
import { baseFoods, baseRecipes } from '../data/catalog'
import { recipeMacrosPerServing } from './recipe'

const foodsById = new Map<string, Food>(baseFoods.map((f) => [f.id, f]))

describe('catalogues alimentaires', () => {
  it('tous les ingrédients de recette référencent un aliment existant', () => {
    for (const r of baseRecipes) {
      for (const ing of r.ingredients) {
        expect(foodsById.has(ing.foodId), `${r.id} → ${ing.foodId}`).toBe(true)
      }
    }
  })
})

describe('recipeMacrosPerServing (§8.4)', () => {
  it('la salade complète (déjeuner) est cohérente : ~700 kcal et protéines suffisantes', () => {
    const salade = baseRecipes.find((r) => r.id === 'salade-complete')!
    const m = recipeMacrosPerServing(salade, foodsById)
    // Un déjeuner du programme vise ~700 kcal / ~55 g de protéines (§8.4).
    expect(m.kcal).toBeGreaterThan(600)
    expect(m.kcal).toBeLessThan(800)
    expect(m.proteinG).toBeGreaterThanOrEqual(50)
  })

  it('le shaker du matin apporte ~35 g de protéines', () => {
    const shaker = baseRecipes.find((r) => r.id === 'shaker-matin')!
    const m = recipeMacrosPerServing(shaker, foodsById)
    expect(m.proteinG).toBeGreaterThan(30)
  })
})
