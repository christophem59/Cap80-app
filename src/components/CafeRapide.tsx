import { useState } from 'react'
import { useDayMeals, addMealItem } from '../repo/meals'
import { useFoods } from '../repo/catalogFood'
import { macrosForGrams } from '../domain/recipe'
import { todayLocal } from '../domain/dates'

/** Le café rapide : un aliment du catalogue, une quantité, un créneau. */
const CAFE_FOOD_ID = 'cafe-noir'
const CAFE_ML = 200
const CAFE_SLOT = 'extra' as const

/**
 * Bouton d'enregistrement en un tap d'un café noir sans sucre (200 ml).
 *
 * Il écrit TOUJOURS sur la journée du jour, quel que soit l'écran depuis lequel on le
 * touche : on enregistre un café qu'on est en train de boire. Le libellé le dit, pour
 * qu'aucun tap ne soit ambigu depuis un écran qui montre une autre période.
 *
 * Les macros viennent du catalogue (macrosForGrams), pas de valeurs recopiées ici : si
 * la fiche du café est corrigée un jour, ce bouton suit sans modification.
 */
export function CafeRapide() {
  const today = todayLocal()
  const foods = useFoods()
  const dayMeals = useDayMeals(today)
  const [busy, setBusy] = useState(false)

  const cafe = foods.find((f) => f.id === CAFE_FOOD_ID)
  // Le compteur du jour EST le retour visuel : pas de message fugace qu'on peut rater,
  // et un double tap involontaire se voit immédiatement.
  const dejaBus = dayMeals
    .flatMap((m) => m.items)
    .filter((it) => it.foodId === CAFE_FOOD_ID).length

  if (!cafe) return null

  const m = macrosForGrams(cafe, CAFE_ML)
  const r1 = (x: number) => Math.round(x * 10) / 10

  async function ajouter() {
    if (!cafe || busy) return
    setBusy(true)
    try {
      await addMealItem(today, CAFE_SLOT, {
        foodId: cafe.id,
        // Le libellé du catalogue contient déjà ses propres parenthèses
        // (« Café noir (sans sucre) ») : on sépare la quantité par un point médian
        // plutôt que d'empiler une seconde paire.
        label: `${cafe.label} · ${CAFE_ML} ml`,
        grams: CAFE_ML,
        kcal: Math.round(m.kcal),
        proteinG: r1(m.proteinG),
        fatG: r1(m.fatG),
        carbsG: r1(m.carbsG),
        fiberG: r1(m.fiberG),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <button
        type="button"
        onClick={() => void ajouter()}
        disabled={busy}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        + Café noir 200 ml
      </button>
      <div className="min-w-0 text-xs text-[var(--text-muted)]">
        <p>
          Sans sucre · {Math.round(m.kcal)} kcal — enregistré sur <strong>aujourd’hui</strong>.
        </p>
        <p>
          {dejaBus === 0
            ? 'Aucun café enregistré aujourd’hui.'
            : `${dejaBus} café${dejaBus > 1 ? 's' : ''} aujourd’hui.`}
        </p>
      </div>
    </section>
  )
}
