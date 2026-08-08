import { useMemo, useState } from 'react'
import type { Food, MealSlot } from '../../domain/types'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing } from '../../domain/recipe'
import { addMealItem, SLOT_LABELS, SLOTS } from '../../repo/meals'
import { addSelection } from '../../repo/shoppingList'
import { todayLocal } from '../../domain/dates'

function r1(x: number) {
  return Math.round(x * 10) / 10
}

export function RecipeView({ recipeId, onBack }: { recipeId: string; onBack: () => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const recipe = recipes.find((r) => r.id === recipeId)
  const [servings, setServings] = useState(recipe?.servings ?? 1)
  const [slot, setSlot] = useState<MealSlot>(recipe?.slot?.[0] ?? 'dejeuner')
  const [msg, setMsg] = useState<string | null>(null)

  if (!recipe) {
    return (
      <p className="p-6 text-center text-sm text-[var(--text-muted)]">
        Recette introuvable.{' '}
        <button type="button" onClick={onBack} className="underline">
          Retour
        </button>
      </p>
    )
  }

  const perServing = recipeMacrosPerServing(recipe, foodsById)
  const factor = servings / recipe.servings

  async function eatIt() {
    await addMealItem(
      todayLocal(),
      slot,
      {
        foodId: undefined,
        label: recipe!.label + (servings > 1 ? ` ×${servings}` : ''),
        grams: null,
        kcal: Math.round(perServing.kcal * servings),
        proteinG: r1(perServing.proteinG * servings),
        fatG: r1(perServing.fatG * servings),
        carbsG: r1(perServing.carbsG * servings),
        fiberG: r1(perServing.fiberG * servings),
      },
      recipe!.id,
    )
    setMsg(`Ajouté à ${SLOT_LABELS[slot].toLowerCase()} (aujourd'hui).`)
  }

  async function toShopping() {
    await addSelection(recipe!.id, servings)
    setMsg('Ajouté à la liste de courses.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{recipe.label}</h1>
        <button type="button" onClick={onBack} className="text-sm text-[var(--text-muted)] underline">
          Retour
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Prépa {recipe.prepMin} min · Cuisson {recipe.cookMin} min
        {recipe.batchFriendly ? ' · batch cooking' : ''}
      </p>

      {/* Portions. */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">Portions</span>
        <button
          type="button"
          onClick={() => setServings((s) => Math.max(1, s - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-lg"
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums">{servings}</span>
        <button
          type="button"
          onClick={() => setServings((s) => s + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-lg"
        >
          +
        </button>
      </div>

      {/* Macros par portion (recalcul en direct). */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Par portion</p>
        <p className="mt-1 text-sm tabular-nums">
          <span className="text-lg font-semibold">{perServing.kcal} kcal</span> · P{' '}
          {perServing.proteinG} · L {perServing.fatG} · G {perServing.carbsG} · Fibres{' '}
          {perServing.fiberG}
        </p>
      </section>

      {/* Ingrédients scalés. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-2 text-sm font-semibold">Ingrédients ({servings} portions)</h2>
        <ul className="space-y-1 text-sm">
          {recipe.ingredients.map((ing) => (
            <li key={ing.foodId} className="flex justify-between">
              <span>{foodsById.get(ing.foodId)?.label ?? ing.foodId}</span>
              <span className="tabular-nums text-[var(--text-muted)]">
                {Math.round(ing.grams * factor)} g
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Étapes. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-2 text-sm font-semibold">Préparation</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>

      {/* Actions. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as MealSlot)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
          >
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={eatIt}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            J'ai mangé ça
          </button>
        </div>
        <button
          type="button"
          onClick={toShopping}
          className="w-full rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium"
        >
          Ajouter à la liste de courses
        </button>
        {msg && <p className="text-center text-xs" style={{ color: 'var(--ok)' }}>{msg}</p>}
      </div>
    </div>
  )
}
