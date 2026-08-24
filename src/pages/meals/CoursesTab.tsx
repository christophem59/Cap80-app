import { useMemo, useState } from 'react'
import type { Food, Recipe } from '../../domain/types'
import { buildShoppingList } from '../../domain/shopping'
import type { ShoppingLineItem } from '../../domain/shopping'
import { FOOD_CATEGORY_LABELS } from '../../domain/labels'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import {
  useShopping,
  setSelection,
  setServings,
  clearSelection,
  toggleChecked,
  clearChecked,
  addFreeItem,
  removeFreeItem,
} from '../../repo/shoppingList'

const lineKey = (l: ShoppingLineItem) => l.foodId ?? l.label

export function CoursesTab() {
  const foods = useFoods()
  const recipes = useRecipes()
  const { selection, freeItems, checked } = useShopping()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const recipeById = useMemo(() => new Map<string, Recipe>(recipes.map((r) => [r.id, r])), [recipes])
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [freeLabel, setFreeLabel] = useState('')
  const [freeQty, setFreeQty] = useState('')

  const groups = useMemo(
    () => buildShoppingList(selection, freeItems, { recipes: recipeById, foods: foodsById }),
    [selection, freeItems, recipeById, foodsById],
  )

  const totalLines = groups.reduce((s, g) => s + g.items.length, 0)
  const checkedCount = groups.reduce(
    (s, g) => s + g.items.filter((it) => checked.has(lineKey(it))).length,
    0,
  )

  async function submitFreeItem(e: React.FormEvent) {
    e.preventDefault()
    const label = freeLabel.trim()
    if (!label) return
    const n = parseFloat(freeQty.replace(',', '.'))
    await addFreeItem({
      label,
      category: 'autre',
      ...(Number.isFinite(n) && n > 0 ? { count: n } : {}),
    })
    setFreeLabel('')
    setFreeQty('')
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

  const empty = selection.length === 0 && freeItems.length === 0

  const freeItemForm = (
    <form onSubmit={submitFreeItem} className="flex gap-2">
      <input
        value={freeLabel}
        onChange={(e) => setFreeLabel(e.target.value)}
        placeholder="Ajouter un article (café, PQ…)"
        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
      />
      <input
        value={freeQty}
        onChange={(e) => setFreeQty(e.target.value)}
        inputMode="decimal"
        placeholder="qté"
        aria-label="Quantité (optionnel)"
        className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-center text-sm tabular-nums"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        +
      </button>
    </form>
  )

  if (empty) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune recette sélectionnée. Va dans l'onglet <strong>Recettes</strong>, coche celles que
          tu vas cuisiner et ajuste les portions, puis « Ajouter aux courses ».
        </p>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <h2 className="mb-2 text-sm font-semibold">Article hors recette</h2>
          {freeItemForm}
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Recettes sélectionnées, portions ajustables. */}
      {selection.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recettes ({selection.length})</h2>
            <button type="button" onClick={() => void clearSelection()} className="text-xs text-[var(--text-muted)] underline">
              Tout effacer
            </button>
          </div>
          <ul className="space-y-1.5 text-sm">
            {selection.map((s) => (
              <li key={s.recipeId} className="flex items-center gap-2">
                <span className="flex-1">{recipeById.get(s.recipeId)?.label ?? s.recipeId}</span>
                <button
                  type="button"
                  onClick={() => void setServings(s.recipeId, s.servings - 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-xs"
                  aria-label="Moins de portions"
                >
                  −
                </button>
                <span className="w-10 text-center tabular-nums text-[var(--text-muted)]">
                  {s.servings} p.
                </span>
                <button
                  type="button"
                  onClick={() => void setServings(s.recipeId, s.servings + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-xs"
                  aria-label="Plus de portions"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => void setSelection(selection.filter((x) => x.recipeId !== s.recipeId))}
                  className="text-xs text-[var(--text-muted)] underline"
                  aria-label="Retirer la recette"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Articles hors recette. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="mb-2 text-sm font-semibold">Article hors recette</h2>
        {freeItemForm}
        {freeItems.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {freeItems.map((it, i) => (
              <li key={`${it.label}-${i}`} className="flex items-center gap-2">
                <span className="flex-1">{it.label}</span>
                {it.count != null && (
                  <span className="tabular-nums text-[var(--text-muted)]">×{it.count}</span>
                )}
                <button
                  type="button"
                  onClick={() => void removeFreeItem(i)}
                  className="text-xs text-[var(--text-muted)] underline"
                  aria-label="Retirer l'article"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Progression du remplissage du panier. */}
      <div className="flex items-center justify-between px-1 text-xs text-[var(--text-muted)]">
        <span className="tabular-nums">
          {checkedCount} / {totalLines} article{totalLines > 1 ? 's' : ''} pris
        </span>
        {checkedCount > 0 && (
          <button type="button" onClick={() => void clearChecked()} className="underline">
            Tout décocher
          </button>
        )}
      </div>

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
