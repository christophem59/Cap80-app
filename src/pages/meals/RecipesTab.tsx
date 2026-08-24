import { useMemo } from 'react'
import type { Food } from '../../domain/types'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing } from '../../domain/recipe'

// Bibliothèque de recettes (ex-« Batch »). Liste TOUTES les recettes ; un picto 🍲
// signale celles préparables à l'avance (batch cooking).
export function RecipesTab({ onOpenRecipe }: { onOpenRecipe: (id: string) => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const sorted = useMemo(
    () => [...recipes].sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [recipes],
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        Tes recettes. <span aria-hidden="true">🍲</span> = préparable à l'avance (batch cooking).
      </p>
      {sorted.map((r) => {
        const m = recipeMacrosPerServing(r, foodsById)
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpenRecipe(r.id)}
            className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {r.batchFriendly && (
                <span title="Préparable à l'avance" aria-label="Préparable à l'avance">
                  🍲
                </span>
              )}
              {r.label}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {r.servings} portion{r.servings > 1 ? 's' : ''} · {r.prepMin + r.cookMin} min ·{' '}
              {m.kcal} kcal/portion · P {m.proteinG}
            </span>
          </button>
        )
      })}
    </div>
  )
}
