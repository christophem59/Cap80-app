import type { Food, Recipe, FoodCategory } from './types'

export interface ShoppingSelection {
  recipeId: string
  servings: number
}

export interface ShoppingFreeItem {
  label: string
  category?: FoodCategory
  grams?: number
  count?: number
}

export interface ShoppingLineItem {
  foodId?: string
  label: string
  category: FoodCategory
  /** Quantité en grammes arrondie à l'unité d'achat, ou null si comptée à la pièce. */
  grams: number | null
  /** Nombre de pièces (œufs…), quand l'aliment se compte à l'unité. */
  count?: number
  checked: boolean
}

export interface ShoppingGroup {
  category: FoodCategory
  items: ShoppingLineItem[]
}

// §6.9 — Ordre d'un parcours de supermarché. « épicerie » = epices puis autre.
const CATEGORY_ORDER: FoodCategory[] = [
  'legumes',
  'fruits',
  'proteines',
  'laitiers',
  'feculents',
  'epices',
  'autre',
  'gras',
  'boissons',
]

// Pas d'arrondi à l'unité d'achat pratique par catégorie (§6.9 : légumes 100 g,
// viande 50 g ; les autres à un pas raisonnable).
const ROUND_STEP: Record<FoodCategory, number> = {
  legumes: 100,
  fruits: 100,
  proteines: 50,
  laitiers: 10,
  feculents: 50,
  gras: 10,
  epices: 5,
  boissons: 100,
  autre: 10,
}

function roundUp(grams: number, step: number): number {
  return Math.ceil(grams / step) * step
}

/** Les œufs se comptent à la pièce (§6.9). Détection par l'identifiant d'aliment. */
function isUnitFood(food: Food | undefined): boolean {
  return !!food && /^oeuf|^œuf/.test(food.id)
}

function unitGrams(food: Food): number {
  return food.servings?.[0]?.grams ?? 50
}

/**
 * §6.9 — Liste de courses. Développe chaque recette en ingrédients, multiplie par le
 * nombre de portions demandées (ingredients exprimés pour `recipe.servings` portions),
 * agrège par foodId, arrondit à l'unité d'achat, groupe par catégorie dans l'ordre du
 * parcours de supermarché.
 */
export function buildShoppingList(
  selections: ShoppingSelection[],
  freeItems: ShoppingFreeItem[],
  catalog: { recipes: Map<string, Recipe>; foods: Map<string, Food> },
): ShoppingGroup[] {
  // 1) Agrège les grammes par foodId.
  const grams = new Map<string, number>()
  for (const sel of selections) {
    const recipe = catalog.recipes.get(sel.recipeId)
    if (!recipe) continue
    const factor = sel.servings / recipe.servings
    for (const ing of recipe.ingredients) {
      grams.set(ing.foodId, (grams.get(ing.foodId) ?? 0) + ing.grams * factor)
    }
  }

  // 2) Transforme en lignes, avec arrondi et gestion des pièces.
  const lines: ShoppingLineItem[] = []
  for (const [foodId, total] of grams) {
    const food = catalog.foods.get(foodId)
    const category: FoodCategory = food?.category ?? 'autre'
    if (isUnitFood(food)) {
      lines.push({
        foodId,
        label: food!.label,
        category,
        grams: null,
        count: Math.max(1, Math.round(total / unitGrams(food!))),
        checked: false,
      })
    } else {
      lines.push({
        foodId,
        label: food?.label ?? foodId,
        category,
        grams: roundUp(total, ROUND_STEP[category]),
        checked: false,
      })
    }
  }

  // 3) Articles libres, ajoutés tels quels.
  for (const item of freeItems) {
    lines.push({
      label: item.label,
      category: item.category ?? 'autre',
      grams: item.grams ?? null,
      ...(item.count !== undefined ? { count: item.count } : {}),
      checked: false,
    })
  }

  // 4) Groupe et trie par ordre de parcours, articles triés par libellé.
  const groups: ShoppingGroup[] = []
  for (const category of CATEGORY_ORDER) {
    const items = lines
      .filter((l) => l.category === category)
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    if (items.length) groups.push({ category, items })
  }
  return groups
}
