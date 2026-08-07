import { useEffect, useState } from 'react'
import type { MacroLine } from '../../domain/nutrition'
import type { MealLog, MealSlot } from '../../domain/types'
import { todayLocal, addDays, calendarWeek } from '../../domain/dates'
import { phaseForCalendarWeek } from '../../domain/plan'
import { dailyTotals } from '../../domain/nutrition'
import { useProfile } from '../../repo/profile'
import {
  useDayMeals,
  removeMealItem,
  setSlotItems,
  getRecentMealsForSlot,
  SLOTS,
  SLOT_LABELS,
} from '../../repo/meals'
import { AddFoodDialog } from './AddFoodDialog'

function frDate(d: string) {
  return d === todayLocal() ? "Aujourd'hui" : `${d.slice(8)}/${d.slice(5, 7)}`
}
function statusColor(s: MacroLine['status']) {
  return s === 'over' ? 'var(--warn)' : s === 'under' ? 'var(--warn)' : s === 'ok' ? 'var(--ok)' : 'var(--text-muted)'
}

function TotalRow({ label, line, unit }: { label: string; line: MacroLine; unit: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums" style={{ color: statusColor(line.status) }}>
        {Math.round(line.value)}
        {line.target != null ? ` / ${Math.round(line.target)}` : ''} {unit}
      </span>
    </div>
  )
}

export function JournalTab() {
  const profile = useProfile()
  const [date, setDate] = useState(todayLocal())
  const meals = useDayMeals(date)
  const [addingSlot, setAddingSlot] = useState<MealSlot | null>(null)
  const [refaireSlot, setRefaireSlot] = useState<MealSlot | null>(null)
  const [recent, setRecent] = useState<MealLog[]>([])

  const week = calendarWeek(profile.startDate, date)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const items = meals.flatMap((m) => m.items)
  const totals = dailyTotals(items, phase ?? { ...profile.plan.phases[0] })

  useEffect(() => {
    if (!refaireSlot) return
    void getRecentMealsForSlot(date, refaireSlot).then(setRecent)
  }, [refaireSlot, date])

  const bySlot = (slot: MealSlot) => meals.find((m) => m.slot === slot)

  return (
    <div className="space-y-4">
      {/* Navigation de jour. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          ←
        </button>
        <span className="text-sm font-medium">{frDate(date)}</span>
        <button
          type="button"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= todayLocal()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
        >
          →
        </button>
      </div>

      {/* Totaux du jour vs cibles (§6.8). */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Totaux du jour {phase ? `· ${phase.label}` : ''}
        </h2>
        <TotalRow label="Calories" line={totals.kcal} unit="kcal" />
        <TotalRow label="Protéines (à atteindre)" line={totals.proteinG} unit="g" />
        <TotalRow label="Lipides" line={totals.fatG} unit="g" />
        <TotalRow label="Glucides" line={totals.carbsG} unit="g" />
        <TotalRow label="Fibres (mini)" line={totals.fiberG} unit="g" />
      </section>

      {/* Créneaux. */}
      {SLOTS.map((slot) => {
        const log = bySlot(slot)
        return (
          <section key={slot} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{SLOT_LABELS[slot]}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRefaireSlot(refaireSlot === slot ? null : slot)
                    setAddingSlot(null)
                  }}
                  className="text-xs text-[var(--text-muted)] underline"
                >
                  Refaire
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingSlot(addingSlot === slot ? null : slot)
                    setRefaireSlot(null)
                  }}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  Ajouter
                </button>
              </div>
            </div>

            {log && log.items.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {log.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="flex-1">
                      {it.label}
                      {it.grams != null ? (
                        <span className="text-[var(--text-muted)]"> · {it.grams} g</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {it.kcal} kcal · P{Math.round(it.proteinG)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeMealItem(date, slot, i)}
                      className="text-xs text-[var(--text-muted)] underline"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Rien pour l'instant.</p>
            )}

            {refaireSlot === slot && (
              <div className="mt-2 rounded-lg bg-[var(--surface-2)] p-2">
                <p className="mb-1 text-xs font-medium">Refaire un repas récent</p>
                {recent.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Aucun repas récent pour ce créneau.</p>
                ) : (
                  <ul className="space-y-1">
                    {recent.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void setSlotItems(date, slot, m.items, m.fromRecipeId)
                            setRefaireSlot(null)
                          }}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-left text-xs"
                        >
                          <span className="text-[var(--text-muted)]">
                            {m.date.slice(8)}/{m.date.slice(5, 7)} ·{' '}
                          </span>
                          {m.items.map((it) => it.label).join(', ')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {addingSlot === slot && (
              <div className="mt-2">
                <AddFoodDialog date={date} slot={slot} onClose={() => setAddingSlot(null)} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
