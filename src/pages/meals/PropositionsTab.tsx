import { useMemo, useState } from 'react'
import type { Food, MealItem, PlannedDay, PlannedMeal, Recipe } from '../../domain/types'
import weekJson from '../../data/week.default.json'
import { useFoods, useRecipes } from '../../repo/catalogFood'
import { recipeMacrosPerServing, macrosForGrams } from '../../domain/recipe'
import { addMealItem, SLOT_LABELS } from '../../repo/meals'
import { todayLocal } from '../../domain/dates'

// Semaine planifiée (injectée via un bundle, cf. docs/injection-repas.md).
// Format courant : days[].meals[] (plusieurs entrées par créneau, `time` facultatif).
// Compat : l'ancien format days[].slots{slot: recipeId} est converti à la lecture.
function readWeek(): PlannedDay[] {
  const days = (weekJson as { days: unknown[] }).days ?? []
  return days.map((d) => {
    const day = d as { label: string; isRestaurantDay?: boolean; meals?: PlannedMeal[]; slots?: Record<string, string> }
    if (Array.isArray(day.meals)) return { label: day.label, isRestaurantDay: day.isRestaurantDay, meals: day.meals }
    const meals: PlannedMeal[] = Object.entries(day.slots ?? {}).map(([slot, recipeId]) => ({
      slot: slot as PlannedMeal['slot'],
      recipeId,
    }))
    return { label: day.label, meals }
  })
}

const r1 = (x: number) => Math.round(x * 10) / 10

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/** Libellé du jour courant, tel qu'écrit dans la semaine planifiée. */
function todayDayLabel(): string {
  return DAY_LABELS[new Date(`${todayLocal()}T00:00:00`).getDay()]
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--text-muted)] transition-transform duration-150"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function PropositionsTab({ onOpenRecipe }: { onOpenRecipe: (id: string) => void }) {
  const foods = useFoods()
  const recipes = useRecipes()
  const foodsById = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods])
  const recipeById = useMemo(() => new Map<string, Recipe>(recipes.map((r) => [r.id, r])), [recipes])
  const week = useMemo(readWeek, [])
  const [added, setAdded] = useState<string | null>(null)
  // Replier/déplier par jour : seul le jour courant est ouvert au départ.
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set([todayDayLabel()]))

  const toggleDay = (label: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  const flash = (key: string) => {
    setAdded(key)
    setTimeout(() => setAdded((k) => (k === key ? null : k)), 1500)
  }

  /** Convertit un repas planifié en item de journal (macros figées à la saisie). */
  function toItem(m: PlannedMeal): MealItem | null {
    if (m.recipeId) {
      const r = recipeById.get(m.recipeId)
      if (!r) return null
      const per = recipeMacrosPerServing(r, foodsById)
      const q = m.portions ?? 1
      return {
        label: r.label + (q !== 1 ? ` ×${q}` : ''),
        grams: null,
        kcal: Math.round(per.kcal * q),
        proteinG: r1(per.proteinG * q),
        fatG: r1(per.fatG * q),
        carbsG: r1(per.carbsG * q),
        fiberG: r1(per.fiberG * q),
      }
    }
    if (m.foodId && m.grams != null) {
      const f = foodsById.get(m.foodId)
      if (!f) return null
      const mm = macrosForGrams(f, m.grams)
      return {
        foodId: f.id,
        label: f.label,
        grams: m.grams,
        kcal: Math.round(mm.kcal),
        proteinG: r1(mm.proteinG),
        fatG: r1(mm.fatG),
        carbsG: r1(mm.carbsG),
        fiberG: r1(mm.fiberG),
      }
    }
    if (m.estimated) {
      return {
        label: m.note?.trim() || 'Repas estimé',
        grams: null,
        kcal: Math.round(m.estimated.kcal),
        proteinG: r1(m.estimated.proteinG),
        fatG: 0,
        carbsG: 0,
        fiberG: 0,
      }
    }
    return null
  }

  async function logMeal(m: PlannedMeal, key: string) {
    const item = toItem(m)
    if (!item) return
    await addMealItem(todayLocal(), m.slot, item, m.recipeId)
    flash(key)
  }

  async function logDay(day: PlannedDay) {
    for (const m of sortMeals(day.meals)) {
      const item = toItem(m)
      if (item) await addMealItem(todayLocal(), m.slot, item, m.recipeId)
    }
    flash(`day-${day.label}`)
  }

  /** Tri par `time` quand il est présent, sinon ordre du tableau. */
  function sortMeals(meals: PlannedMeal[]): PlannedMeal[] {
    return meals
      .map((m, i) => ({ m, i }))
      .sort((a, b) => {
        if (a.m.time && b.m.time) return a.m.time.localeCompare(b.m.time)
        if (a.m.time) return -1
        if (b.m.time) return 1
        return a.i - b.i
      })
      .map((x) => x.m)
  }

  function describe(m: PlannedMeal): { label: string; sub: string; recipeId?: string } {
    if (m.recipeId) {
      const r = recipeById.get(m.recipeId)
      if (!r) return { label: `Recette inconnue (${m.recipeId})`, sub: '' }
      const per = recipeMacrosPerServing(r, foodsById)
      const q = m.portions ?? 1
      return {
        label: r.label + (q !== 1 ? ` ×${q}` : ''),
        sub: `${Math.round(per.kcal * q)} kcal · P ${r1(per.proteinG * q)}`,
        recipeId: r.id,
      }
    }
    if (m.foodId && m.grams != null) {
      const f = foodsById.get(m.foodId)
      if (!f) return { label: `Aliment inconnu (${m.foodId})`, sub: '' }
      const mm = macrosForGrams(f, m.grams)
      return { label: `${f.label} · ${m.grams} g`, sub: `${Math.round(mm.kcal)} kcal · P ${r1(mm.proteinG)}` }
    }
    if (m.estimated) {
      return {
        label: m.note?.trim() || 'Repas estimé',
        sub: `~${Math.round(m.estimated.kcal)} kcal · P ${r1(m.estimated.proteinG)} (estimé)`,
      }
    }
    return { label: '—', sub: '' }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Ta semaine préparée. Touche un plat pour la recette, « + auj. » pour l'ajouter au journal
        du jour, ou « + tout le jour » pour la journée entière.
      </p>
      {week.map((day) => {
        const isOpen = openDays.has(day.label)
        const meals = sortMeals(day.meals)
        const dayKcal = meals.reduce((s, m) => {
          const it = toItem(m)
          return s + (it?.kcal ?? 0)
        }, 0)
        return (
          <section key={day.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleDay(day.label)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Chevron open={isOpen} />
                <h2 className="truncate text-sm font-semibold">
                  {day.label}
                  {day.isRestaurantDay && (
                    <span className="ml-1.5" title="Jour restaurant" aria-label="Jour restaurant">
                      🍴
                    </span>
                  )}
                  {dayKcal > 0 && (
                    <span className="ml-2 text-[11px] font-normal tabular-nums text-[var(--text-muted)]">
                      {dayKcal} kcal
                    </span>
                  )}
                </h2>
              </button>
              <button
                type="button"
                onClick={() => void logDay(day)}
                className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px]"
                style={
                  added === `day-${day.label}` ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined
                }
              >
                {added === `day-${day.label}` ? '✓ ajouté' : '+ tout le jour'}
              </button>
            </div>
            {isOpen && (
            <ul className="mt-2 space-y-2">
              {meals.map((m, i) => {
                const d = describe(m)
                const key = `${day.label}-${i}`
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] uppercase text-[var(--text-muted)]">
                      {m.time ?? SLOT_LABELS[m.slot].slice(0, 5) + '.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => d.recipeId && onOpenRecipe(d.recipeId)}
                      disabled={!d.recipeId}
                      className="flex-1 text-left text-sm disabled:cursor-default"
                    >
                      {d.label}
                      <span className="block text-[11px] tabular-nums text-[var(--text-muted)]">
                        {d.sub}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void logMeal(m, key)}
                      className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px]"
                      style={added === key ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined}
                    >
                      {added === key ? '✓' : '+ auj.'}
                    </button>
                  </li>
                )
              })}
            </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
