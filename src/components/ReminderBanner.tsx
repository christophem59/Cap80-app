import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeights } from '../repo/weights'
import { useDayMeals } from '../repo/meals'
import { useSteps } from '../repo/steps'
import { getReminderPrefs, reminderItems, type ReminderKey } from '../pwa/reminders'
import { todayLocal } from '../domain/dates'

// Bannière de rappel in-app (filet de sécurité fiable, indépendant des notifications
// OS) : liste les saisies du jour manquantes dont l'heure de rappel est dépassée.
const DISMISS_KEY = 'cap80.reminders.bannerDismissed'

function nowHhmm(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ReminderBanner() {
  const navigate = useNavigate()
  const today = todayLocal()
  const weights = useWeights()
  const meals = useDayMeals(today)
  const steps = useSteps()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === today,
  )

  const prefs = getReminderPrefs()

  const pending = useMemo<Record<ReminderKey, boolean>>(
    () => ({
      weigh: !weights.some((w) => w.date === today),
      meals: meals.length === 0,
      steps: !steps.some((s) => s.date === today),
    }),
    [weights, meals, steps, today],
  )

  const hm = nowHhmm()
  const due = prefs.enabled
    ? reminderItems(prefs).filter((it) => it.on && pending[it.key] && hm >= it.time)
    : []

  if (dismissed || due.length === 0) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, today)
    setDismissed(true)
  }

  return (
    <section
      className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3"
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">À ne pas oublier aujourd’hui</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer les rappels"
          className="shrink-0 text-xs text-[var(--text-muted)] underline"
        >
          Masquer
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {due.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => navigate(it.url.replace(/^#/, ''))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)]"
          >
            {it.key === 'weigh' ? '⚖️ Me peser' : it.key === 'meals' ? '🍽️ Noter mes repas' : '👟 Saisir mes pas'}
          </button>
        ))}
      </div>
    </section>
  )
}
