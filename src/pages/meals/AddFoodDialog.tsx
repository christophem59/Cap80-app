import { useMemo, useState } from 'react'
import type { Food, MealItem, MealSlot, LocalDate } from '../../domain/types'
import { useFoods } from '../../repo/catalogFood'
import { macrosForGrams } from '../../domain/recipe'
import { addMealItem, SLOT_LABELS } from '../../repo/meals'

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
function r1(x: number) {
  return Math.round(x * 10) / 10
}

export function AddFoodDialog({
  date,
  slot,
  onClose,
}: {
  date: LocalDate
  slot: MealSlot
  onClose: () => void
}) {
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('')
  const [free, setFree] = useState(false)
  const [freeItem, setFreeItem] = useState({ label: '', kcal: '', prot: '', fat: '', carbs: '' })

  const matches = useMemo(() => {
    const q = norm(query)
    if (!q) return foods.slice(0, 12)
    return foods.filter((f) => norm(f.label).includes(q)).slice(0, 20)
  }, [query, foods])

  async function addFromFood() {
    if (!selected) return
    const g = parseFloat(grams.replace(',', '.'))
    if (!Number.isFinite(g) || g <= 0) return
    const m = macrosForGrams(selected, g)
    const item: MealItem = {
      foodId: selected.id,
      label: selected.label,
      grams: r1(g),
      kcal: Math.round(m.kcal),
      proteinG: r1(m.proteinG),
      fatG: r1(m.fatG),
      carbsG: r1(m.carbsG),
      fiberG: r1(m.fiberG),
    }
    await addMealItem(date, slot, item)
    onClose()
  }

  async function addFree() {
    const kcal = parseFloat(freeItem.kcal.replace(',', '.'))
    if (!freeItem.label.trim() || !Number.isFinite(kcal)) return
    const num = (s: string) => {
      const n = parseFloat(s.replace(',', '.'))
      return Number.isFinite(n) ? r1(n) : 0
    }
    await addMealItem(date, slot, {
      label: freeItem.label.trim(),
      grams: null,
      kcal: Math.round(kcal),
      proteinG: num(freeItem.prot),
      fatG: num(freeItem.fat),
      carbsG: num(freeItem.carbs),
      fiberG: 0,
    })
    onClose()
  }

  const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm'

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ajouter à {SLOT_LABELS[slot].toLowerCase()}</h3>
        <button type="button" onClick={onClose} className="text-xs text-[var(--text-muted)] underline">
          Fermer
        </button>
      </div>

      <div className="mb-2 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setFree(false)}
          className={`rounded-full px-3 py-1 ${!free ? 'text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
          style={!free ? { background: 'var(--accent)' } : undefined}
        >
          Catalogue
        </button>
        <button
          type="button"
          onClick={() => setFree(true)}
          className={`rounded-full px-3 py-1 ${free ? 'text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
          style={free ? { background: 'var(--accent)' } : undefined}
        >
          Saisie libre
        </button>
      </div>

      {free ? (
        <div className="space-y-2">
          <input
            className={input}
            placeholder="Nom de l'aliment"
            value={freeItem.label}
            onChange={(e) => setFreeItem({ ...freeItem, label: e.target.value })}
          />
          <div className="grid grid-cols-4 gap-2">
            {(['kcal', 'prot', 'fat', 'carbs'] as const).map((k) => (
              <input
                key={k}
                className={input}
                inputMode="decimal"
                placeholder={k === 'kcal' ? 'kcal' : k === 'prot' ? 'P' : k === 'fat' ? 'L' : 'G'}
                value={freeItem[k]}
                onChange={(e) => setFreeItem({ ...freeItem, [k]: e.target.value })}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addFree}
            className="w-full rounded-lg py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Ajouter
          </button>
        </div>
      ) : !selected ? (
        <>
          <input
            className={input}
            placeholder="Rechercher un aliment…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="mt-2 max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
            {matches.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(f)
                    setGrams(f.servings?.[0]?.grams != null ? String(f.servings[0].grams) : '100')
                  }}
                  className="flex w-full items-center justify-between py-2 text-left text-sm"
                >
                  <span>{f.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{f.per100g.kcal} kcal/100g</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="py-2 text-xs text-[var(--text-muted)]">Aucun aliment trouvé.</li>
            )}
          </ul>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{selected.label}</p>
          {selected.servings && selected.servings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.servings.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setGrams(String(s.grams))}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <label className="block text-xs text-[var(--text-muted)]">
            Quantité (g)
            <input
              className={input}
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </label>
          <p className="text-xs text-[var(--text-muted)]">
            {(() => {
              const g = parseFloat(grams.replace(',', '.'))
              if (!Number.isFinite(g) || g <= 0) return '—'
              const m = macrosForGrams(selected, g)
              return `${Math.round(m.kcal)} kcal · P ${r1(m.proteinG)} · L ${r1(m.fatG)} · G ${r1(m.carbsG)}`
            })()}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]"
            >
              ← Changer
            </button>
            <button
              type="button"
              onClick={addFromFood}
              className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
