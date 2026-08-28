import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../repo/profile'
import { useWeights } from '../repo/weights'
import { useWorkouts } from '../repo/workouts'
import { useSteps } from '../repo/steps'
import { useMealsInRange, useDayMeals, addMealItem } from '../repo/meals'
import { useFoods } from '../repo/catalogFood'
import { macrosForGrams } from '../domain/recipe'
import { todayLocal, addDays, calendarWeek } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'
import type { MealItem } from '../domain/types'

// §backlog « Vue Ta semaine » : récap hebdo en un coup d'œil (repas, pas, séances,
// pesées) + « critères du programme remplis cette semaine ? ». Semaine = bloc de 7 j
// du programme (à partir de startDate), cohérent avec les phases.

function dayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })
}
function rangeLabel(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  const a = new Date(start + 'T00:00:00').toLocaleDateString('fr-FR', opts)
  const b = new Date(end + 'T00:00:00').toLocaleDateString('fr-FR', opts)
  return `${a} – ${b}`
}
function fmtKg(n: number) {
  return n.toFixed(1).replace('.', ',')
}
/** Le café rapide : un aliment du catalogue, une quantité, un créneau. */
const CAFE_FOOD_ID = 'cafe-noir'
const CAFE_ML = 200
const CAFE_SLOT = 'extra' as const

/**
 * Bouton d'enregistrement en un tap d'un café noir sans sucre (200 ml).
 *
 * Il écrit TOUJOURS sur la journée du jour, quelle que soit la semaine affichée : on
 * enregistre un café qu'on est en train de boire, pas un café de la semaine dernière.
 * Le libellé le dit, pour qu'aucun tap ne soit ambigu depuis une semaine passée.
 *
 * Les macros viennent du catalogue (macrosForGrams), pas de valeurs recopiées ici : si
 * la fiche du café est corrigée un jour, ce bouton suit sans modification.
 */
function CafeRapide() {
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
        className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
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

function sumItems(items: MealItem[]) {
  return items.reduce(
    (s, it) => ({ kcal: s.kcal + it.kcal, protein: s.protein + it.proteinG }),
    { kcal: 0, protein: 0 },
  )
}

export function WeekReview() {
  const navigate = useNavigate()
  const profile = useProfile()
  const weights = useWeights()
  const workouts = useWorkouts()
  const steps = useSteps()

  const today = todayLocal()
  const currentWeek = calendarWeek(profile.startDate, today)
  const [week, setWeek] = useState(currentWeek)

  const firstDay = addDays(profile.startDate, (week - 1) * 7)
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(firstDay, i)), [firstDay])
  const lastDay = dates[6]

  const meals = useMealsInRange(firstDay, lastDay)
  const phase = phaseForCalendarWeek(profile.plan, week)

  const kcalTarget = phase && !phase.ramp ? phase.targetKcal : null
  const proteinTarget = phase?.proteinG ?? null
  const stepGoal = phase ? profile.plan.stepGoals[phase.id] : undefined
  const workoutTarget = phase?.workoutsPerWeek

  // Agrégats par jour puis synthèse.
  const perDay = useMemo(() => {
    const itemsByDate = new Map<string, MealItem[]>()
    for (const m of meals) {
      const arr = itemsByDate.get(m.date) ?? []
      arr.push(...m.items)
      itemsByDate.set(m.date, arr)
    }
    return dates.map((date) => {
      const items = itemsByDate.get(date) ?? []
      const logged = items.length > 0
      const { kcal, protein } = sumItems(items)
      return {
        date,
        logged,
        kcal,
        protein,
        weight: weights.find((w) => w.date === date)?.weightKg,
        workout: workouts.some((w) => w.date === date),
        steps: steps.find((s) => s.date === date)?.steps,
        isFuture: date > today,
      }
    })
  }, [dates, meals, weights, workouts, steps, today])

  const loggedDays = perDay.filter((d) => d.logged)
  const avgKcal = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length)
    : null
  const avgProtein = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length)
    : null
  const stepDays = perDay.filter((d) => d.steps != null)
  const avgSteps = stepDays.length
    ? Math.round(stepDays.reduce((s, d) => s + (d.steps ?? 0), 0) / stepDays.length)
    : null
  const workoutCount = perDay.filter((d) => d.workout).length
  const weighIns = perDay.filter((d) => d.weight != null).length

  type Status = 'ok' | 'warn' | 'none'
  const criteria: { label: string; value: string; status: Status }[] = []
  if (kcalTarget != null) {
    criteria.push({
      label: 'Calories',
      value: avgKcal != null ? `moy. ${avgKcal} / ${kcalTarget} kcal` : 'non saisi',
      status: avgKcal == null ? 'none' : avgKcal <= kcalTarget ? 'ok' : 'warn',
    })
  }
  if (proteinTarget != null) {
    criteria.push({
      label: 'Protéines',
      value: avgProtein != null ? `moy. ${avgProtein} / ${proteinTarget} g` : 'non saisi',
      status: avgProtein == null ? 'none' : avgProtein >= proteinTarget ? 'ok' : 'warn',
    })
  }
  if (workoutTarget != null) {
    criteria.push({
      label: 'Séances',
      value: `${workoutCount} / ${workoutTarget}`,
      status: workoutCount >= workoutTarget ? 'ok' : 'warn',
    })
  }
  if (stepGoal != null) {
    criteria.push({
      label: 'Pas',
      value: avgSteps != null ? `moy. ${avgSteps.toLocaleString('fr-FR')} / ${stepGoal.toLocaleString('fr-FR')}` : 'non saisi',
      status: avgSteps == null ? 'none' : avgSteps >= stepGoal ? 'ok' : 'warn',
    })
  }

  const metCount = criteria.filter((c) => c.status === 'ok').length
  const allMet = criteria.length > 0 && metCount === criteria.length

  const color = (s: Status) =>
    s === 'ok' ? 'var(--ok)' : s === 'warn' ? 'var(--warn)' : 'var(--border)'

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ta semaine</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-[var(--text-muted)] underline"
        >
          Fermer
        </button>
      </div>

      <CafeRapide />

      {/* Navigation de semaine. */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <button
          type="button"
          onClick={() => setWeek((w) => Math.max(0, w - 1))}
          disabled={week <= 0}
          className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-30"
          aria-label="Semaine précédente"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            Semaine {week}
            {week === currentWeek ? ' (en cours)' : ''}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {rangeLabel(firstDay, lastDay)}
            {phase ? ` · ${phase.label}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWeek((w) => Math.min(currentWeek, w + 1))}
          disabled={week >= currentWeek}
          className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-30"
          aria-label="Semaine suivante"
        >
          ›
        </button>
      </div>

      {/* Critères du programme. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {phase?.kind === 'calibration' ? (
          <p className="text-sm text-[var(--text-muted)]">
            Semaine de calibrage : mange normalement et pèse-toi. Pas de cible à remplir.
          </p>
        ) : criteria.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Hors programme — pas de cible.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-white"
                style={{ background: allMet ? 'var(--ok)' : 'var(--warn)' }}
                aria-hidden="true"
              >
                {allMet ? '✓' : metCount}
              </span>
              <p className="text-sm font-medium">
                {allMet
                  ? 'Tous les critères remplis cette semaine 🎉'
                  : `${metCount} / ${criteria.length} critères remplis`}
              </p>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {criteria.map((c) => (
                <li key={c.label} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color(c.status) }}
                    aria-hidden="true"
                  />
                  <span className="w-20 shrink-0 text-[var(--text-muted)]">{c.label}</span>
                  <span
                    className="flex-1 tabular-nums"
                    style={c.status !== 'none' ? { color: color(c.status) } : undefined}
                  >
                    {c.value}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Détail jour par jour. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
        <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Jour par jour
        </h2>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase text-[var(--text-muted)]">
                <th className="px-2 py-1 text-left font-medium">Jour</th>
                <th className="px-2 py-1 text-right font-medium">Poids</th>
                <th className="px-2 py-1 text-right font-medium">kcal</th>
                <th className="px-2 py-1 text-right font-medium">Prot.</th>
                <th className="px-2 py-1 text-center font-medium">Séance</th>
                <th className="px-2 py-1 text-right font-medium">Pas</th>
              </tr>
            </thead>
            <tbody>
              {perDay.map((d) => (
                <tr
                  key={d.date}
                  className={`border-t border-[var(--border)] ${d.isFuture ? 'opacity-40' : ''} ${d.date === today ? 'font-medium' : ''}`}
                >
                  <td className="px-2 py-1.5 text-left capitalize">{dayLabel(d.date)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {d.weight != null ? fmtKg(d.weight) : '·'}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums"
                    style={
                      d.logged && kcalTarget != null
                        ? { color: d.kcal <= kcalTarget ? 'var(--ok)' : 'var(--warn)' }
                        : undefined
                    }
                  >
                    {d.logged ? Math.round(d.kcal) : '·'}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums"
                    style={
                      d.logged && proteinTarget != null
                        ? { color: d.protein >= proteinTarget ? 'var(--ok)' : 'var(--warn)' }
                        : undefined
                    }
                  >
                    {d.logged ? Math.round(d.protein) : '·'}
                  </td>
                  <td className="px-2 py-1.5 text-center">{d.workout ? '✓' : '·'}</td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums"
                    style={
                      d.steps != null && stepGoal != null
                        ? { color: d.steps >= stepGoal ? 'var(--ok)' : 'var(--warn)' }
                        : undefined
                    }
                  >
                    {d.steps != null ? d.steps.toLocaleString('fr-FR') : '·'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-2 py-2 text-[11px] text-[var(--text-muted)]">
          Pesées cette semaine : <span className="tabular-nums">{weighIns}/7</span>. Les moyennes
          calories/protéines portent sur les jours réellement saisis.
        </p>
      </section>
    </section>
  )
}
