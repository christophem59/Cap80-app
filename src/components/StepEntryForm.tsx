import { useMemo, useState } from 'react'
import { useSteps, saveSteps } from '../repo/steps'
import { useProfile } from '../repo/profile'
import { todayLocal, calendarWeek } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'

// Saisie rapide des pas du jour (réutilisée sur Aujourd'hui et l'écran Pas).
export function StepEntryForm({ onSaved }: { onSaved?: () => void }) {
  const steps = useSteps()
  const profile = useProfile()
  const today = todayLocal()
  const byDate = useMemo(() => new Map(steps.map((s) => [s.date, s.steps])), [steps])
  const todayValue = byDate.get(today)
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const goal = phase ? profile.plan.stepGoals[phase.id] : undefined

  async function save() {
    const n = parseInt(value.replace(/\s/g, ''), 10)
    if (!Number.isFinite(n) || n < 0) return
    await saveSteps(today, n, 'manual')
    setSaved(true)
    setValue('')
    onSaved?.()
  }

  return (
    <div>
      {goal != null && (
        <p className="mb-1 text-xs text-[var(--text-muted)]">
          Objectif <span className="tabular-nums">{goal.toLocaleString('fr-FR')}</span> pas
          {todayValue != null && !saved && (
            <> · déjà saisi {todayValue.toLocaleString('fr-FR')} (re-saisir remplace)</>
          )}
        </p>
      )}
      <div className="flex items-stretch gap-2">
        <input
          inputMode="numeric"
          aria-label="Nombre de pas du jour"
          placeholder={todayValue != null ? String(todayValue) : 'ex. 9421'}
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
