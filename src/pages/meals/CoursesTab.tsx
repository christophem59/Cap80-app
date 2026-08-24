import { useMemo, useState } from 'react'
import type { Food, Recipe } from '../../domain/types'
import { buildShoppingList } from '../../domain/shopping'
import type { ShoppingLineItem } from '../../domain/shopping'
import { FOOD_CATEGORY_LABELS } from '../../domain/labels'
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
      <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
        Aucune recette sélectionnée. Va dans l'onglet <strong>Recettes</strong>, coche celles que
        tu vas cuisiner et ajuste les portions, puis « Ajouter aux courses ».
      </p>
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
