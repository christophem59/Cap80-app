import { describe, it, expect } from 'vitest'
import type { Food, Recipe } from './types'
import { buildShoppingList } from './shopping'

const foods = new Map<string, Food>([
  [
    'courgette',
    {
      id: 'courgette',
      label: 'Courgette',
      category: 'legumes',
      per100g: { kcal: 17, proteinG: 1.2, fatG: 0.3, carbsG: 2, fiberG: 1 },
    },
  ],
  [
    'poulet-blanc-cru',
    {
      id: 'poulet-blanc-cru',
      label: 'Blanc de poulet, cru',
      category: 'proteines',
      per100g: { kcal: 120, proteinG: 23, fatG: 2.6, carbsG: 0, fiberG: 0 },
    },
  ],
  [
    'oeuf',
    {
      id: 'oeuf',
      label: 'Œuf entier',
      category: 'proteines',
      per100g: { kcal: 143, proteinG: 12.6, fatG: 9.5, carbsG: 0.7, fiberG: 0 },
      servings: [{ label: '1 œuf', grams: 50 }],
    },
  ],
])

const recipes = new Map<string, Recipe>([
  [
    'r1',
    {
      id: 'r1',
      label: 'Poulet-courgettes',
      slot: ['dejeuner'],
      servings: 2,
      prepMin: 5,
      cookMin: 20,
      batchFriendly: false,
      ingredients: [
        { foodId: 'courgette', grams: 200 },
        { foodId: 'poulet-blanc-cru', grams: 300 },
      ],
      steps: [],
    },
  ],
  [
    'r2',
    {
      id: 'r2',
      label: 'Omelette-courgettes',
      slot: ['diner'],
      servings: 4,
      prepMin: 5,
      cookMin: 10,
      batchFriendly: false,
      ingredients: [
        { foodId: 'courgette', grams: 400 },
        { foodId: 'oeuf', grams: 300 }, // 6 œufs
      ],
      steps: [],
    },
  ],
])

describe('buildShoppingList (§6.9)', () => {
  it('agrège les ingrédients communs, arrondit, groupe et ordonne', () => {
    const groups = buildShoppingList(
      [
        { recipeId: 'r1', servings: 2 },
        { recipeId: 'r2', servings: 4 },
      ],
      [],
      { recipes, foods },
    )

    // Ordre de parcours : légumes avant protéines.
    expect(groups.map((g) => g.category)).toEqual(['legumes', 'proteines'])

    // Courgette agrégée : 200 (r1) + 400 (r2) = 600 g.
    const courgette = groups[0].items[0]
    expect(courgette).toMatchObject({ label: 'Courgette', grams: 600 })

    // Protéines triées par libellé, œufs comptés à la pièce.
    const prot = groups[1].items
    expect(prot.map((i) => i.label)).toEqual(['Blanc de poulet, cru', 'Œuf entier'])
    expect(prot[0]).toMatchObject({ grams: 300 })
    expect(prot[1]).toMatchObject({ grams: null, count: 6 })
  })

  it('multiplie par le nombre de portions demandées', () => {
    // r1 produit 2 portions ; on en demande 4 → tout est doublé.
    const groups = buildShoppingList([{ recipeId: 'r1', servings: 4 }], [], {
      recipes,
      foods,
    })
    expect(groups.find((g) => g.category === 'legumes')!.items[0].grams).toBe(400)
    expect(groups.find((g) => g.category === 'proteines')!.items[0].grams).toBe(600)
  })

  it('arrondit à l’unité d’achat (légumes 100 g, viande 50 g)', () => {
    // r1 x1 portion : courgette 100 g, poulet 150 g (déjà multiples).
    // On force un reste via r2 x1 : courgette 100 g → total 100+... testons un arrondi.
    const one = new Map<string, Recipe>([
      [
        'r3',
        {
          id: 'r3',
          label: 'test',
          slot: ['dejeuner'],
          servings: 3,
          prepMin: 0,
          cookMin: 0,
          batchFriendly: false,
          ingredients: [
            { foodId: 'courgette', grams: 250 }, // /3 * 1 = 83.3 → arrondi 100
            { foodId: 'poulet-blanc-cru', grams: 250 }, // 83.3 → arrondi 100 (pas de 50)
          ],
          steps: [],
        },
      ],
    ])
    const groups = buildShoppingList([{ recipeId: 'r3', servings: 1 }], [], {
      recipes: one,
      foods,
    })
    expect(groups.find((g) => g.category === 'legumes')!.items[0].grams).toBe(100)
    expect(groups.find((g) => g.category === 'proteines')!.items[0].grams).toBe(100)
  })

  it('ajoute les articles libres dans leur catégorie', () => {
    const groups = buildShoppingList([], [{ label: 'Sel', category: 'epices' }], {
      recipes,
      foods,
    })
    expect(groups).toEqual([
      {
        category: 'epices',
        items: [
          { label: 'Sel', category: 'epices', grams: null, checked: false },
        ],
      },
    ])
  })
})
