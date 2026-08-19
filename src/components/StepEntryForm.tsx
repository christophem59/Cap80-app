import { useMemo, useState } from 'react'
import { useSteps, saveSteps } from '../repo/steps'
import { useProfile } from '../repo/profile'
import { todayLocal, calendarWeek } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'

// Saisie des pas. Par défaut sur le jour courant (saisie rapide, écran Aujourd'hui).
// Avec `withDate`, un sélecteur de date permet le rattrapage d'un jour passé
// (écran Pas) : on peut corriger n'importe quelle journée jusqu'à aujourd'hui.
export function StepEntryForm({
  onSaved,
  withDate = false,
}: {
  onSaved?: () => void
  withDate?: boolean
}) {
  const steps = useSteps()
  const profile = useProfile()
  const today = todayLocal()
  const [date, setDate] = useState(today)
  const byDate = useMemo(() => new Map(steps.map((s) => [s.date, s.steps])), [steps])
  const dayValue = byDate.get(date)
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  const week = calendarWeek(profile.startDate, date)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const goal = phase ? profile.plan.stepGoals[phase.id] : undefined

  async function save() {
    const n = parseInt(value.replace(/\s/g, ''), 10)
    if (!Number.isFinite(n) || n < 0) return
    await saveSteps(date, n, 'manual')
    setSaved(true)
    setValue('')
    onSaved?.()
  }

  return (
    <div>
      {withDate && (
        <div className="mb-2">
          <label htmlFor="step-date" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Jour {date === today ? '(aujourd’hui)' : ''}
          </label>
          <input
            id="step-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value || today)
              setValue('')
              setSaved(false)
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
        </div>
      )}
      {goal != null && (
        <p className="mb-1 text-xs text-[var(--text-muted)]">
          Objectif <span className="tabular-nums">{goal.toLocaleString('fr-FR')}</span> pas
          {dayValue != null && !saved && (
            <> · déjà saisi {dayValue.toLocaleString('fr-FR')} (re-saisir remplace)</>
          )}
        </p>
      )}
      <div className="flex items-stretch gap-2">
        <input
          inputMode="numeric"
          aria-label={withDate ? 'Nombre de pas du jour sélectionné' : 'Nombre de pas du jour'}
          placeholder={dayValue != null ? String(dayValue) : 'ex. 9421'}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-center text-2xl font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={save}
          className="shrink-0 rounded-lg px-5 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          {saved ? '✓' : 'OK'}
        </button>
      </div>
    </div>
  )
}
