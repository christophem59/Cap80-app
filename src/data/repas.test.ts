import { describe, expect, it } from 'vitest'
import foodsJson from './foods.json'
import recipesJson from './recipes.json'
import weekJson from './week.default.json'

/**
 * Garde-fou du catalogue de repas, éprouvé à chaque injection de bundle.
 *
 * POURQUOI CE FICHIER — les bundles hebdomadaires réécrivent `recipes.json` et
 * `week.default.json` en bloc. Le validateur contrôle le bundle AVANT application ;
 * rien ne contrôlait le résultat APRÈS. Une référence cassée ou un créneau inconnu ne
 * se voyait donc qu'à l'écran, la semaine commencée.
 */
type Recipe = {
  id: string
  slot: string[]
  servings: number
  prepMin?: number
  cookMin?: number
  batchFriendly?: boolean
  ingredients: { foodId: string; grams: number }[]
  steps: string[]
}
type Meal = {
  slot: string
  recipeId?: string
  foodId?: string
  grams?: number
  portions?: number
  /** Repas non décomposé (restaurant) : macros figées telles quelles. */
  estimated?: { kcal: number; proteinG: number; fiberG?: number }
}

const foods = (foodsJson as { foods: { id: string }[] }).foods
const recipes = (recipesJson as { recipes: Recipe[] }).recipes
const week = weekJson as { days: { label: string; meals: Meal[] }[] }

const foodIds = new Set(foods.map((f) => f.id))
const recipeIds = new Set(recipes.map((r) => r.id))

const CRENEAUX_RECETTE = ['petit-dej', 'dejeuner', 'collation', 'diner']
const CRENEAUX_SEMAINE = [...CRENEAUX_RECETTE, 'extra']
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

describe('catalogue de recettes', () => {
  it('les identifiants sont uniques', () => {
    expect(recipeIds.size).toBe(recipes.length)
  })

  it('chaque ingrédient référence un aliment du catalogue', () => {
    const orphelins = recipes.flatMap((r) =>
      r.ingredients.filter((i) => !foodIds.has(i.foodId)).map((i) => `${r.id} → ${i.foodId}`),
    )
    expect(orphelins).toEqual([])
  })

  it('les grammages sont des nombres strictement positifs', () => {
    const faux = recipes.flatMap((r) =>
      r.ingredients.filter((i) => !(i.grams > 0)).map((i) => `${r.id} → ${i.foodId}`),
    )
    expect(faux).toEqual([])
  })

  it('les créneaux restent dans ceux que connaît une recette', () => {
    // « extra » est une POSITION dans la semaine, pas un créneau de recette :
    // un dessert se déclare « collation » et se place en « extra ».
    const hors = recipes
      .filter((r) => !r.slot.length || r.slot.some((s) => !CRENEAUX_RECETTE.includes(s)))
      .map((r) => `${r.id} (${r.slot.join(',')})`)
    expect(hors).toEqual([])
  })

  it('servings est un entier strictement positif', () => {
    const faux = recipes.filter((r) => !Number.isInteger(r.servings) || r.servings <= 0)
    expect(faux.map((r) => r.id)).toEqual([])
  })

  it('les durées sont facultatives, mais valides quand elles sont là', () => {
    // Une recette injectée peut ne pas connaître son temps de cuisine ; l'app
    // n'affiche alors aucune durée. Ce qui est interdit, c'est une durée absurde.
    const faux = recipes.filter((r) =>
      (['prepMin', 'cookMin'] as const).some((k) => r[k] !== undefined && !(r[k]! >= 0)),
    )
    expect(faux.map((r) => r.id)).toEqual([])
  })
})

describe('semaine par défaut', () => {
  it('sept jours, libellés attendus et dans l’ordre', () => {
    // L'app compare le libellé au jour courant : une minuscule et le jour ne s'ouvre pas.
    expect(week.days.map((d) => d.label)).toEqual(JOURS)
  })

  it('chaque repas porte un créneau connu', () => {
    const hors = week.days.flatMap((d) =>
      d.meals.filter((m) => !CRENEAUX_SEMAINE.includes(m.slot)).map((m) => `${d.label} → ${m.slot}`),
    )
    expect(hors).toEqual([])
  })

  it('chaque repas référence une recette ou un aliment existants', () => {
    const orphelins = week.days.flatMap((d) =>
      d.meals
        .filter(
          (m) =>
            (m.recipeId !== undefined && !recipeIds.has(m.recipeId)) ||
            (m.foodId !== undefined && !foodIds.has(m.foodId)),
        )
        .map((m) => `${d.label} → ${m.recipeId ?? m.foodId}`),
    )
    expect(orphelins).toEqual([])
  })

  it('un repas décrit exactement une source', () => {
    // Trois sources possibles, jamais deux à la fois : une recette du catalogue,
    // un aliment pesé, ou une estimation figée (le restaurant, qu'on ne décompose pas).
    const ambigus = week.days.flatMap((d) =>
      d.meals
        .filter((m) => (m.recipeId ? 1 : 0) + (m.foodId ? 1 : 0) + (m.estimated ? 1 : 0) !== 1)
        .map((m) => `${d.label} → ${JSON.stringify(m)}`),
    )
    expect(ambigus).toEqual([])
  })

  it('un repas estimé chiffre au moins ses calories et ses protéines', () => {
    // Ces valeurs ne sont recalculables par rien : si elles manquent, le jour est faux
    // sans que personne ne le voie.
    const incomplets = week.days.flatMap((d) =>
      d.meals
        .filter((m) => m.estimated && !(m.estimated.kcal > 0 && m.estimated.proteinG >= 0))
        .map((m) => `${d.label} → ${JSON.stringify(m.estimated)}`),
    )
    expect(incomplets).toEqual([])
  })

  it('un aliment posé directement porte un grammage', () => {
    const sansPoids = week.days.flatMap((d) =>
      d.meals.filter((m) => m.foodId && !(m.grams! > 0)).map((m) => `${d.label} → ${m.foodId}`),
    )
    expect(sansPoids).toEqual([])
  })

  it('chaque jour couvre les quatre repas principaux', () => {
    const incomplets = week.days
      .filter((d) => !CRENEAUX_RECETTE.every((s) => d.meals.some((m) => m.slot === s)))
      .map((d) => d.label)
    expect(incomplets).toEqual([])
  })
})
