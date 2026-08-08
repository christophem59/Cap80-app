import { useMemo, useState } from 'react'
import type { Food, Recipe } from '../../domain/types'
import { buildShoppingList } from '../../domain/shopping'
import type { ShoppingLineItem } from '../../domain/shopping'
import { FOOD_CATEGORY_LABELS } from '../../domain/labels'
import weekJson from '../../data/week.default.json'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import {
  useShopping,
  setSelection,
  clearSelection,
  toggleChecked,
} from '../../repo/shoppingList'

const lineKey = (l: ShoppingLineItem) => l.foodId ?? l.label

export function CoursesTab() {
  const foods = useFoods()
  const recipes = useRecipes()
  const { selection, checked } = useShopping()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const recipeById = useMemo(() => new Map<string, Recipe>(recipes.map((r) => [r.id, r])), [recipes])
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const groups = useMemo(
    () => buildShoppingList(selection, [], { recipes: recipeById, foods: foodsById }),
    [selection, recipeById, foodsById],
  )

  async function addWeek() {
    // Agrège la semaine type : 1 portion par proposition.
    const counts = new Map<string, number>()
    for (const day of weekJson.days as { slots: Record<string, string> }[]) {
      for (const id of Object.values(day.slots)) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    await setSelection([...counts].map(([recipeId, servings]) => ({ recipeId, servings })))
  }

  function shareText(): string {
    const lines: string[] = ['Liste de courses', '']
    for (const g of groups) {
      lines.push(FOOD_CATEGORY_LABELS[g.category].toUpperCase())
      for (const it of g.items) {
        const qty = it.count != null ? `${it.count}` : it.grams != null ? `${it.grams} g` : ''
        lines.push(`- ${it.label}${qty ? ` : ${qty}` : ''}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  async function share() {
    const text = shareText()
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
    } catch {
      /* annulé : on tente le presse-papier */
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareMsg('Liste copiée dans le presse-papier.')
      setTimeout(() => setShareMsg(null), 2000)
    } catch {
      setShareMsg('Partage indisponible.')
    }
  }

  if (selection.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune recette sélectionnée. Ajoute des recettes depuis « Propositions » / une recette
          (bouton « Ajouter à la liste de courses »), ou pars de la semaine type.
        </p>
        <button
          type="button"
          onClick={() => void addWeek()}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Générer depuis la semaine type
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Recettes sélectionnées. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recettes ({selection.length})</h2>
          <button type="button" onClick={() => void clearSelection()} className="text-xs text-[var(--text-muted)] underline">
            Tout effacer
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {selection.map((s) => (
            <li key={s.recipeId} className="flex items-center gap-2">
              <span className="flex-1">{recipeById.get(s.recipeId)?.label ?? s.recipeId}</span>
              <span className="tabular-nums text-[var(--text-muted)]">{s.servings} port.</span>
              <button
                type="button"
                onClick={() => void setSelection(selection.filter((x) => x.recipeId !== s.recipeId))}
                className="text-xs text-[var(--text-muted)] underline"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void addWeek()}
          className="mt-2 text-xs underline"
          style={{ color: 'var(--accent)' }}
        >
          Repartir de la semaine type
        </button>
      </section>

      {/* Liste cochable, groupée par rayon. */}
      {groups.map((g) => (
        <section key={g.category} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {FOOD_CATEGORY_LABELS[g.category]}
          </h3>
          <ul>
            {g.items.map((it) => {
              const key = lineKey(it)
              const isChecked = checked.has(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => void toggleChecked(key)}
                    className="flex w-full items-center gap-3 py-1.5 text-left text-sm"
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]"
                      style={
                        isChecked
                          ? { background: 'var(--ok)', borderColor: 'transparent', color: '#fff' }
                          : { borderColor: 'var(--border)' }
                      }
                    >
                      {isChecked ? '✓' : ''}
                    </span>
                    <span className={`flex-1 ${isChecked ? 'text-[var(--text-muted)] line-through' : ''}`}>
                      {it.label}
                    </span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {it.count != null ? `×${it.count}` : it.grams != null ? `${it.grams} g` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <button
        type="button"
        onClick={() => void share()}
        className="w-full rounded-lg py-3 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        Partager la liste
      </button>
      {shareMsg && <p className="text-center text-xs text-[var(--text-muted)]">{shareMsg}</p>}
    </div>
  )
}
