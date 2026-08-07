import type { Food, Macros, Recipe } from './types'

const ZERO: Macros = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 }

/** Macros d'une quantité en grammes d'un aliment (valeurs par 100 g × grammes/100). */
export function macrosForGrams(food: Food, grams: number): Macros {
  const f = grams / 100
  return {
    kcal: food.per100g.kcal * f,
    proteinG: food.per100g.proteinG * f,
    fatG: food.per100g.fatG * f,
    carbsG: food.per100g.carbsG * f,
    fiberG: food.per100g.fiberG * f,
  }
}

function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    fatG: a.fatG + b.fatG,
    carbsG: a.carbsG + b.carbsG,
    fiberG: a.fiberG + b.fiberG,
  }
}

function roundMacros(m: Macros): Macros {
  const r1 = (x: number) => Math.round(x * 10) / 10
  return {
    kcal: Math.round(m.kcal),
    proteinG: r1(m.proteinG),
    fatG: r1(m.fatG),
    carbsG: r1(m.carbsG),
    fiberG: r1(m.fiberG),
  }
}

/** Macros totales d'une recette (toutes portions), calculées depuis les ingrédients. */
export function recipeTotalMacros(recipe: Recipe, foodsById: Map<string, Food>): Macros {
  let total = ZERO
  for (const ing of recipe.ingredients) {
    const food = foodsById.get(ing.foodId)
    if (!food) continue // ingrédient inconnu : ignoré (l'UI pourra le signaler)
    total = add(total, macrosForGrams(food, ing.grams))
  }
  return roundMacros(total)
}

/** Macros par portion (§7.3 : recalcul en direct selon le nombre de portions). */
export function recipeMacrosPerServing(recipe: Recipe, foodsById: Map<string, Food>): Macros {
  let total = ZERO
  for (const ing of recipe.ingredients) {
    const food = foodsById.get(ing.foodId)
    if (!food) continue
    total = add(total, macrosForGrams(food, ing.grams))
  }
  const s = recipe.servings || 1
  return roundMacros({
    kcal: total.kcal / s,
    proteinG: total.proteinG / s,
    fatG: total.fatG / s,
    carbsG: total.carbsG / s,
    fiberG: total.fiberG / s,
  })
}
