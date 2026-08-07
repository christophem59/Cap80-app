import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Profile, WeightEntry } from '../domain/types'
import { addDays, toDayNumber, ageFromBirthYear } from '../domain/dates'
import { trailingAvg } from '../domain/weight'
import { projectTrajectory } from '../domain/projection'

export type Period = 30 | 90 | 'all'

interface Row {
  t: number // timestamp (ms) — axe X numérique
  weight?: number
  avg?: number
  proj?: number
}

function toTs(date: string): number {
  return toDayNumber(date) * 86_400_000
}

export function WeightChart({
  weights,
  profile,
  period,
}: {
  weights: WeightEntry[]
  profile: Profile
  period: Period
}) {
  const data = useMemo<Row[]>(() => {
    // Fenêtre temporelle.
    const asc = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1))
    const lastDate = asc.length ? asc[asc.length - 1].date : profile.startDate
    const fromTs = period === 'all' ? -Infinity : toTs(addDays(lastDate, -(period - 1)))
    // Borne droite : sur 30/90 j, on ne montre la projection que sur une fenêtre
    // équivalente vers l'avant, sinon l'horizon (~10 mois) écrase les données réelles.
    const toTsBound = period === 'all' ? Infinity : toTs(addDays(lastDate, period))

    const byTs = new Map<number, Row>()
    const put = (t: number, patch: Partial<Row>) => {
      byTs.set(t, { ...(byTs.get(t) ?? { t }), ...patch, t })
    }

    // Pesées quotidiennes + moyenne mobile 7 j à chaque date.
    for (const w of asc) {
      const t = toTs(w.date)
      if (t < fromTs) continue
      put(t, { weight: w.weightKg })
      const avg = trailingAvg(weights, w.date)
      if (avg != null) put(t, { avg: Math.round(avg * 100) / 100 })
    }

    // Projection : trajectoire planifiée depuis le poids de départ (§6.6), mappée sur
    // les dates réelles (semaines calendaires depuis startDate).
    const profileForBmr = {
      heightCm: profile.heightCm,
      ageYears: ageFromBirthYear(profile.birthYear, new Date().getFullYear()),
      sex: profile.sex,
      activityFactor: profile.activityFactor,
    }
    const proj = projectTrajectory(profile.startWeightKg, profile.plan, profileForBmr, 44)
    for (const p of proj) {
      const t = toTs(addDays(profile.startDate, (p.calendarWeek - 1) * 7))
      if (t < fromTs || t > toTsBound) continue
      put(t, { proj: Math.round(p.weightKg * 100) / 100 })
    }

    return [...byTs.values()].sort((a, b) => a.t - b.t)
  }, [weights, profile, period])

  const fmtDate = (t: number) => {
    const d = new Date(t)
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const fmtKg = (v: number) => `${v.toFixed(1).replace('.', ',')}`

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        Pas encore de pesée à afficher.
      </p>
    )
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtDate}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            stroke="var(--border)"
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={fmtKg}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            width={44}
            stroke="var(--border)"
          />
          <Tooltip
            labelFormatter={(t) => fmtDate(Number(t))}
            formatter={(v: number, name) => [`${fmtKg(v)} kg`, name]}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={profile.targetWeightKg}
            stroke="var(--ok)"
            strokeDasharray="4 4"
            label={{
              value: `Objectif ${fmtKg(profile.targetWeightKg)}`,
              position: 'insideBottomRight',
              fill: 'var(--ok)',
              fontSize: 10,
            }}
          />
          {/* Projection : pointillés discrets. */}
          <Line
            dataKey="proj"
            name="Projection"
            stroke="var(--text-muted)"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {/* Pesées quotidiennes : points fins et discrets. */}
          <Scatter dataKey="weight" name="Pesée" fill="var(--text-muted)" />
          {/* Moyenne mobile 7 j : la ligne qui porte le sens. */}
          <Line
            dataKey="avg"
            name="Moyenne 7 j"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
