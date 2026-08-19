import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeights } from '../repo/weights'
import { useMeasurements } from '../repo/measurements'
import { useDayMeals } from '../repo/meals'
import { useWorkouts } from '../repo/workouts'
import { useSteps } from '../repo/steps'
import { useProfile } from '../repo/profile'
import { WeightEntryForm } from '../components/WeightEntryForm'
import { StepEntryForm } from '../components/StepEntryForm'
import { ReminderBanner } from '../components/ReminderBanner'
import { todayLocal, calendarWeek } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'
import { trailingAvg, weeklyAverages, lossRate } from '../domain/weight'
import { dailyTotals } from '../domain/nutrition'

function fmtKg(n: number) {
  return n.toFixed(1).replace('.', ',')
}
function signedKg(n: number) {
  const s = fmtKg(Math.abs(n))
  return n < 0 ? `−${s}` : `+${s}`
}

export function Today() {
  const weights = useWeights()
  const measurements = useMeasurements()
  const meals = useDayMeals(todayLocal())
  const workouts = useWorkouts()
  const steps = useSteps()
  const profile = useProfile()
  const navigate = useNavigate()
  const [weighing, setWeighing] = useState(false)
  const [stepping, setStepping] = useState(false)

  const today = todayLocal()
  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const avg = trailingAvg(weights, today)
  const latest = weights[0]

  // Ce qui est enregistré aujourd'hui.
  const todayWeight = weights.find((w) => w.date === today)?.weightKg
  const dayItems = meals.flatMap((m) => m.items)
  const totals = dailyTotals(dayItems, phase ?? profile.plan.phases[0])
  const todaySteps = steps.find((s) => s.date === today)?.steps
  const stepGoal = phase ? profile.plan.stepGoals[phase.id] : undefined
  const weeklyWorkouts = workouts.filter(
    (w) => calendarWeek(profile.startDate, w.date) === week,
  ).length
  const workoutTarget = phase?.workoutsPerWeek
  const kcalTarget = phase && !phase.ramp ? phase.targetKcal : null
  const proteinTarget = phase?.proteinG ?? null

  const joursPeses = new Set(
    weights.filter((w) => calendarWeek(profile.startDate, w.date) === week).map((w) => w.date),
  ).size
  const waistThisWeek = measurements.some(
    (m) => m.waistCm != null && calendarWeek(profile.startDate, m.date) === week,
  )
  const adjustmentAvailable = lossRate(weeklyAverages(weights, profile.startDate, 1), 3) !== null

  const reminders: { text: string; to: string }[] = []
  if (!waistThisWeek)
    reminders.push({ text: 'Tour de taille à mesurer cette semaine', to: '/suivi' })
  if (adjustmentAvailable)
    reminders.push({ text: '3 semaines de données : un ajustement est disponible', to: '/ajustement' })

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Aujourd'hui</h1>

      <ReminderBanner />

      {/* Moyenne mobile 7 j en grand. */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {avg == null ? (
          <>
            <p className="text-sm text-[var(--text-muted)]">Moyenne 7 jours</p>
            <p className="mt-1 text-lg text-[var(--text-muted)]">
              Pas encore assez de pesées (4 minimum sur 7 jours).
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)]">Moyenne 7 jours</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums">{fmtKg(avg)} kg</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-[var(--text-muted)]">
                {signedKg(avg - profile.startWeightKg)} kg depuis le départ
              </span>
              <span className="text-[var(--text-muted)]">
                encore {fmtKg(Math.max(0, avg - profile.targetWeightKg))} kg jusqu'à l'objectif
              </span>
            </div>
          </>
        )}
        {latest && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Dernière pesée : {fmtKg(latest.weightKg)} kg le {latest.date.slice(8)}/
            {latest.date.slice(5, 7)}
          </p>
        )}
      </section>

      {/* Actions rapides. */}
      <section>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction
            label="Peser"
            onClick={() => {
              setWeighing((w) => !w)
              setStepping(false)
            }}
            active={weighing}
          />
          <QuickAction label="Repas" onClick={() => navigate('/repas')} />
          <QuickAction label="Séance" onClick={() => navigate('/seances')} />
          <QuickAction
            label="Pas"
            onClick={() => {
              setStepping((s) => !s)
              setWeighing(false)
            }}
            active={stepping}
          />
        </div>
        {weighing && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <WeightEntryForm compact onSaved={() => setWeighing(false)} />
          </div>
        )}
        {stepping && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <StepEntryForm onSaved={() => setStepping(false)} />
            <button
              type="button"
              onClick={() => navigate('/pas')}
              className="mt-2 text-xs underline"
              style={{ color: 'var(--accent)' }}
            >
              Voir le détail des pas
            </button>
          </div>
        )}
      </section>

      {/* Récap de la journée, avec valeurs de référence et code couleur. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
        <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Aujourd'hui vs objectifs
        </h2>
        <ul className="mt-1 divide-y divide-[var(--border)]">
          <RecapRow
            label="Pesée"
            value={todayWeight != null ? `${fmtKg(todayWeight)} kg` : null}
            status="none"
            onClick={() => {
              setWeighing(true)
              setStepping(false)
            }}
          />
          <RecapRow
            label="Calories"
            value={
              dayItems.length || kcalTarget != null
                ? `${Math.round(totals.kcal.value)}${kcalTarget != null ? ` / ${kcalTarget}` : ''} kcal`
                : null
            }
            // Plafond : dans les clous tant qu'on est ≤ cible.
            status={kcalTarget == null ? 'none' : totals.kcal.value <= kcalTarget ? 'ok' : 'warn'}
            onClick={() => navigate('/repas')}
          />
          <RecapRow
            label="Protéines"
            value={
              dayItems.length || proteinTarget != null
                ? `${Math.round(totals.proteinG.value)}${proteinTarget != null ? ` / ${proteinTarget}` : ''} g`
                : null
            }
            // Objectif à ATTEINDRE : vert seulement si ≥ cible.
            status={
              proteinTarget == null ? 'none' : totals.proteinG.value >= proteinTarget ? 'ok' : 'warn'
            }
            onClick={() => navigate('/repas')}
          />
          <RecapRow
            label="Séances"
            value={workoutTarget != null ? `${weeklyWorkouts} / ${workoutTarget} cette sem.` : `${weeklyWorkouts}`}
            status={workoutTarget == null ? 'none' : weeklyWorkouts >= workoutTarget ? 'ok' : 'warn'}
            onClick={() => navigate('/seances')}
          />
          <RecapRow
            label="Pas"
            value={
              todaySteps != null
                ? `${todaySteps.toLocaleString('fr-FR')}${stepGoal ? ` / ${stepGoal.toLocaleString('fr-FR')}` : ''}`
                : null
            }
            status={
              todaySteps == null || stepGoal == null ? 'none' : todaySteps >= stepGoal ? 'ok' : 'warn'
            }
            onClick={() => {
              setStepping(true)
              setWeighing(false)
            }}
          />
        </ul>
      </section>

      {/* Semaine et phase. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium">
          Semaine {week} {phase ? `· ${phase.label}` : ''}
        </p>
        {phase && phase.targetKcal != null ? (
          <p className="mt-1 text-sm text-[var(--text-muted)] tabular-nums">
            {phase.ramp ? 'apport progressif' : `${phase.targetKcal} kcal`}
            {phase.proteinG != null &&
              ` · P ${phase.proteinG} / L ${phase.fatG} / G ${phase.carbsG} g`}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {phase?.kind === 'calibration'
              ? 'Calibrage — pas de cible cette semaine'
              : 'Hors programme'}
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Jours pesés cette semaine : <span className="tabular-nums">{joursPeses}/7</span>
        </p>
      </section>

      {/* Rappels contextuels. */}
      {reminders.length > 0 && (
        <section className="space-y-2">
          {reminders.map((r) => (
            <button
              key={r.to + r.text}
              type="button"
              onClick={() => navigate(r.to)}
              className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: 'var(--accent)' }}
                aria-hidden="true"
              />
              {r.text}
            </button>
          ))}
        </section>
      )}
    </section>
  )
}

function RecapRow({
  label,
  value,
  status,
  onClick,
}: {
  label: string
  value: string | null
  status: 'ok' | 'warn' | 'none'
  onClick: () => void
}) {
  const color = status === 'ok' ? 'var(--ok)' : status === 'warn' ? 'var(--warn)' : undefined
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color ?? 'var(--border)' }}
          aria-hidden="true"
        />
        <span className="w-16 shrink-0 text-[var(--text-muted)]">{label}</span>
        <span
          className={`flex-1 tabular-nums ${value ? '' : 'text-[var(--text-muted)]'}`}
          style={value && color ? { color } : undefined}
        >
          {value ?? 'non enregistré'}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{value ? 'modifier' : '+'}</span>
      </button>
    </li>
  )
}

function QuickAction({
  label,
  onClick,
  active,
  disabled,
  hint,
}: {
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium',
        active
          ? 'border-transparent text-white'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]',
        disabled ? 'opacity-40' : '',
      ].join(' ')}
      style={active ? { background: 'var(--accent)' } : undefined}
    >
      {label}
      {hint && <span className="text-[10px] font-normal text-[var(--text-muted)]">{hint}</span>}
    </button>
  )
}
