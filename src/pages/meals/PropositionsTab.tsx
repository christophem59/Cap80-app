import { useMemo, useState } from 'react'
import type { Food, MealSlot, Recipe } from '../../domain/types'
import weekJson from '../../data/week.default.json'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing } from '../../domain/recipe'
import { addMealItem, SLOT_LABELS } from '../../repo/meals'
import { todayLocal } from '../../domain/dates'

type WeekDay = { label: string; slots: Partial<Record<MealSlot, string>> }
const week = weekJson.days as WeekDay[]
const DAY_SLOTS: MealSlot[] = ['petit-dej', 'dejeuner', 'collation', 'diner']

export function PropositionsTab({ onOpenRecipe }: { onOpenRecipe: (id: string) => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const recipeById = useMemo(() => new Map<string, Recipe>(recipes.map((r) => [r.id, r])), [recipes])
  const [added, setAdded] = useState<string | null>(null)

  async function logToday(recipe: Recipe, slot: MealSlot, key: string) {
    const m = recipeMacrosPerServing(recipe, foodsById)
    await addMealItem(
      todayLocal(),
      slot,
      {
        label: recipe.label,
        grams: null,
        kcal: m.kcal,
        proteinG: m.proteinG,
        fatG: m.fatG,
        carbsG: m.carbsG,
        fiberG: m.fiberG,
      },
      recipe.id,
    )
    setAdded(key)
    setTimeout(() => setAdded((k) => (k === key ? null : k)), 1500)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Semaine type. Touche un plat pour la recette, ou « + aujourd'hui » pour l'ajouter au
        journal du jour.
      </p>
      {week.map((day) => (
        <section key={day.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-2 text-sm font-semibold">{day.label}</h2>
          <ul className="space-y-2">
            {DAY_SLOTS.map((slot) => {
              const id = day.slots[slot]
              const recipe = id ? recipeById.get(id) : undefined
              if (!recipe) return null
              const m = recipeMacrosPerServing(recipe, foodsById)
              const key = `${day.label}-${slot}`
              return (
                <li key={slot} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase text-[var(--text-muted)]">
                    {SLOT_LABELS[slot].slice(0, 5)}.
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenRecipe(recipe.id)}
                    className="flex-1 text-left text-sm"
                  >
                    {recipe.label}
                    <span className="block text-[11px] tabular-nums text-[var(--text-muted)]">
                      {m.kcal} kcal · P {m.proteinG}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void logToday(recipe, slot, key)}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px]"
                    style={added === key ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined}
                  >
                    {added === key ? '✓' : '+ auj.'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
