import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recommendation } from '../domain/types'
import { useProfile } from '../repo/profile'
import { useWeights } from '../repo/weights'
import { useAdjustments, applyAdjustment } from '../repo/adjustments'
import type { ApplyMode } from '../repo/adjustments'
import { todayLocal, calendarWeek, ageFromBirthYear } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'
import { weeklyAverages } from '../domain/weight'
import { recommendAdjustment } from '../domain/adjustment'
import { tdee } from '../domain/metabolism'

const REC_LABELS: Record<Recommendation, string> = {
  increase: 'Augmenter l’apport',
  decrease: 'Réduire l’apport',
  hold: 'Maintenir',
  diet_break: 'Pause à l’entretien',
  audit_journal: 'Pesée stricte',
}

function fmtRate(kg: number): string {
  return `${kg.toFixed(2).replace('.', ',')} kg/sem`
}

export function AdjustmentScreen() {
  const navigate = useNavigate()
  const profile = useProfile()
  const weights = useWeights()
  const history = useAdjustments()
  const [msg, setMsg] = useState<string | null>(null)

  const today = todayLocal()
  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const weekly = useMemo(() => weeklyAverages(weights, profile.startDate, 1), [weights, profile.startDate])

  const currentWeight = weekly.length ? weekly[weekly.length - 1].avg : profile.startWeightKg
  const maintenanceKcal = useMemo(() => {
    const bmr = {
      heightCm: profile.heightCm,
      ageYears: ageFromBirthYear(profile.birthYear, new Date().getFullYear()),
      sex: profile.sex,
      activityFactor: profile.activityFactor,
    }
    return Math.round(tdee(currentWeight, bmr) / 50) * 50
  }, [profile, currentWeight])

  const advice = useMemo(() => {
    if (!phase) return null
    const phaseWeeksElapsed = week - phase.startCalendarWeek + 1
    const strictLoggingCompleted =
      profile.strictLoggingUntil != null && today > profile.strictLoggingUntil
    return recommendAdjustment(weekly, { phaseWeeksElapsed, strictLoggingCompleted })
  }, [weekly, phase, week, profile.strictLoggingUntil, today])

  async function apply(mode: ApplyMode) {
    if (!advice || !phase) return
    await applyAdjustment(advice, mode, phase, today)
    setMsg(mode === 'ignore' ? 'Ajustement ignoré (noté dans l’historique).' : 'Ajustement appliqué.')
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustement</h1>
        <button type="button" onClick={() => navigate('/programme')} className="text-sm text-[var(--text-muted)] underline">
          Programme
        </button>
      </div>

      {/* §7.7 : jamais d'ajustement sous 3 semaines de données. */}
      {!advice ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Il faut au moins <strong>3 semaines complètes</strong> de moyennes hebdomadaires pour
          proposer un ajustement fiable. Continue à te peser régulièrement.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Vitesse mesurée · {advice.weeksAnalysed} semaines
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {fmtRate(advice.observedWeeklyLossKg)}
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
              {REC_LABELS[advice.recommendation]}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{advice.reason}</p>
          </section>

          {/* Données qui composent la décision. */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Moyennes hebdomadaires
            </h2>
            <ul className="text-sm tabular-nums">
              {weekly.slice(-6).map((w) => (
                <li key={w.week} className="flex justify-between py-0.5">
                  <span className="text-[var(--text-muted)]">Semaine {w.week}</span>
                  <span>{w.avg.toFixed(1).replace('.', ',')} kg</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Options (§7.7). */}
          {msg ? (
            <p className="rounded-lg p-3 text-center text-sm" style={{ color: 'var(--ok)' }}>
              {msg}
            </p>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void apply('kcal')}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {advice.recommendation === 'increase' && 'Appliquer +150 kcal/j'}
                {advice.recommendation === 'decrease' && 'Appliquer −100 kcal/j'}
                {advice.recommendation === 'hold' && 'Ne rien changer (noté)'}
                {advice.recommendation === 'audit_journal' && 'Activer la pesée stricte 7 jours'}
                {advice.recommendation === 'diet_break' &&
                  `Passer à l'entretien (${maintenanceKcal} kcal)`}
              </button>
              {advice.recommendation === 'decrease' && (
                <button
                  type="button"
                  onClick={() => void apply('steps')}
                  className="w-full rounded-xl border border-[var(--border)] py-3 text-sm font-medium"
                >
                  Plutôt +2 000 pas/j
                </button>
              )}
              <button
                type="button"
                onClick={() => void apply('ignore')}
                className="w-full rounded-xl border border-[var(--border)] py-3 text-sm font-medium text-[var(--text-muted)]"
              >
                Ignorer
              </button>
            </div>
          )}
        </>
      )}

      {/* Historique des ajustements. */}
      {history.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Historique
          </h2>
          <ul className="space-y-1.5 text-sm">
            {history.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="w-14 shrink-0 tabular-nums text-[var(--text-muted)]">
                  {a.date.slice(8)}/{a.date.slice(5, 7)}
                </span>
                <span className="flex-1">
                  {REC_LABELS[a.recommendation]}
                  {a.appliedKcalDelta !== 0 && ` · ${a.appliedKcalDelta > 0 ? '+' : ''}${a.appliedKcalDelta} kcal`}
                  {a.appliedStepDelta !== 0 && ` · +${a.appliedStepDelta} pas`}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {a.accepted ? 'appliqué' : 'ignoré'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
