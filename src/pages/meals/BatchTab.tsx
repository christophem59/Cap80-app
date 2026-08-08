import { useMemo } from 'react'
import type { Food } from '../../domain/types'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing } from '../../domain/recipe'

export function BatchTab({ onOpenRecipe }: { onOpenRecipe: (id: string) => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const batch = recipes.filter((r) => r.batchFriendly)

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        Recettes qui se préparent en avance, se conservent et se réchauffent bien — idéales le
        week-end pour tenir la semaine.
      </p>
      {batch.map((r) => {
        const m = recipeMacrosPerServing(r, foodsById)
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpenRecipe(r.id)}
            className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left"
          >
            <span className="text-sm font-semibold">{r.label}</span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {r.servings} portions · {r.prepMin + r.cookMin} min · {m.kcal} kcal/portion · P{' '}
              {m.proteinG}
            </span>
          </button>
        )
      })}
    </div>
  )
}
