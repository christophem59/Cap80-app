import { useMemo, useState } from 'react'
import type { Food } from '../../domain/types'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing } from '../../domain/recipe'
import { addSelection } from '../../repo/shoppingList'

// Bibliothèque de recettes (ex-« Batch »). Picto 🍲 = préparable à l'avance.
// Sélection multiple → liste de courses en une fois, avec le nombre de portions
// (défaut : le lot complet de la recette, `servings`).
export function RecipesTab({ onOpenRecipe }: { onOpenRecipe: (id: string) => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const sorted = useMemo(
    () => [...recipes].sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [recipes],
  )

  // recipeId -> portions choisies (présent dans la map = coché)
  const [picked, setPicked] = useState<Map<string, number>>(new Map())
  const [msg, setMsg] = useState<string | null>(null)

  function toggle(id: string, defaultServings: number) {
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, defaultServings)
      return next
    })
    setMsg(null)
  }

  function bump(id: string, delta: number) {
    setPicked((prev) => {
      const next = new Map(prev)
      const cur = next.get(id) ?? 1
      next.set(id, Math.max(1, cur + delta))
      return next
    })
  }

  async function addToShopping() {
    for (const [recipeId, servings] of picked) await addSelection(recipeId, servings)
    setMsg(`${picked.size} recette(s) ajoutée(s) à la liste de courses.`)
    setPicked(new Map())
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        Tes recettes. <span aria-hidden="true">🍲</span> = préparable à l'avance. Coche celles que
        tu vas cuisiner pour générer la liste de courses.
      </p>

      {sorted.map((r) => {
        const m = recipeMacrosPerServing(r, foodsById)
        const isPicked = picked.has(r.id)
        const portions = picked.get(r.id) ?? r.servings
        return (
          <div
            key={r.id}
            className="rounded-xl border bg-[var(--surface)] p-3"
            style={{ borderColor: isPicked ? 'var(--accent)' : 'var(--border)' }}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(r.id, r.servings)}
                aria-pressed={isPicked}
                aria-label={`Sélectionner ${r.label}`}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]"
                style={
                  isPicked
                    ? { background: 'var(--accent)', borderColor: 'transparent', color: '#fff' }
                    : { borderColor: 'var(--border)' }
                }
              >
                {isPicked ? '✓' : ''}
              </button>
              <button type="button" onClick={() => onOpenRecipe(r.id)} className="flex-1 text-left">
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
            </div>

            {isPicked && (
              <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2">
                <span className="text-xs text-[var(--text-muted)]">Portions à acheter</span>
                <button
                  type="button"
                  onClick={() => bump(r.id, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)]"
                  aria-label="Moins"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{portions}</span>
                <button
                  type="button"
                  onClick={() => bump(r.id, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)]"
                  aria-label="Plus"
                >
                  +
                </button>
              </div>
            )}
          </div>
        )
      })}

      {msg && <p className="text-center text-xs" style={{ color: 'var(--ok)' }}>{msg}</p>}

      {picked.size > 0 && (
        <div
          className="sticky bottom-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
        >
          <button
            type="button"
            onClick={() => void addToShopping()}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Ajouter aux courses ({picked.size})
          </button>
        </div>
      )}
    </div>
  )
}
