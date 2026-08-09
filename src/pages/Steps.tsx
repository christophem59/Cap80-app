import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useSteps } from '../repo/steps'
import { useProfile } from '../repo/profile'
import { StepEntryForm } from '../components/StepEntryForm'
import { todayLocal, addDays, calendarWeek, toDayNumber } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'

export function Steps() {
  const steps = useSteps()
  const profile = useProfile()
  const navigate = useNavigate()
  const today = todayLocal()

  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const goal = phase ? profile.plan.stepGoals[phase.id] : undefined

  const byDate = useMemo(() => new Map(steps.map((s) => [s.date, s.steps])), [steps])

  const chart = useMemo(() => {
    const rows: { t: number; steps: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i)
      rows.push({ t: toDayNumber(d) * 86_400_000, steps: byDate.get(d) ?? 0 })
    }
    return rows
  }, [byDate, today])

  const weekAvg = useMemo(() => {
    const vals: number[] = []
    for (let i = 0; i < 7; i++) {
      const v = byDate.get(addDays(today, -i))
      if (v != null) vals.push(v)
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }, [byDate, today])

  const fmtDate = (t: number) => {
    const d = new Date(t)
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pas</h1>
        <button type="button" onClick={() => navigate('/')} className="text-sm text-[var(--text-muted)] underline">
          Fermer
        </button>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <StepEntryForm />
        {weekAvg != null && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Moyenne 7 jours : <span className="tabular-nums">{weekAvg.toLocaleString('fr-FR')}</span> pas/j
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          30 derniers jours
        </h2>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtDate}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                stroke="var(--border)"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                width={40}
                stroke="var(--border)"
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
              />
              <Tooltip
                labelFormatter={(t) => fmtDate(Number(t))}
                formatter={(v: number) => [`${v.toLocaleString('fr-FR')} pas`, 'Pas']}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              {goal != null && <ReferenceLine y={goal} stroke="var(--ok)" strokeDasharray="4 4" />}
              <Bar dataKey="steps" fill="var(--accent)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="px-1 text-xs text-[var(--text-muted)]">
        L'import Health Connect et l'automatisation (boîte de réception) sont dans les réglages.
      </p>
    </section>
  )
}
