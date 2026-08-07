import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BodyMeasurement } from '../../domain/types'
import { todayLocal, toDayNumber } from '../../domain/dates'
import {
  useMeasurements,
  saveMeasurement,
  deleteMeasurement,
  MEASURE_LABELS,
  MEASURE_HELP,
} from '../../repo/measurements'
import type { MeasureField } from '../../repo/measurements'

// Tour de taille en premier et mis en avant (§7.2 : il bouge quand la balance stagne).
const ORDER: MeasureField[] = ['waistCm', 'neckCm', 'chestCm', 'armCm', 'thighCm', 'hipCm']

function fmtCm(n: number) {
  return n.toFixed(1).replace('.', ',')
}

function MiniChart({
  measurements,
  field,
}: {
  measurements: BodyMeasurement[]
  field: MeasureField
}) {
  const data = measurements
    .filter((m) => m[field] != null)
    .map((m) => ({ t: toDayNumber(m.date) * 86_400_000, v: m[field] as number }))
    .sort((a, b) => a.t - b.t)
  if (data.length === 0) return null
  const fmtDate = (t: number) => {
    const d = new Date(t)
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  return (
    <div style={{ width: '100%', height: 120 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtDate}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            stroke="var(--border)"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            width={36}
            stroke="var(--border)"
          />
          <Tooltip
            labelFormatter={(t) => fmtDate(Number(t))}
            formatter={(v: number) => [`${fmtCm(v)} cm`, MEASURE_LABELS[field]]}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            dataKey="v"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MensurationsTab() {
  const measurements = useMeasurements()
  const [date, setDate] = useState(todayLocal())
  const [draft, setDraft] = useState<Partial<Record<MeasureField, string>>>({})
  const [showEntry, setShowEntry] = useState(false)
  const [helpOpen, setHelpOpen] = useState<MeasureField | null>(null)

  async function handleSave() {
    const fields: Partial<Record<MeasureField, number>> = {}
    for (const f of ORDER) {
      const raw = draft[f]
      if (raw != null && raw !== '') {
        const n = parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(n) && n > 0) fields[f] = Math.round(n * 10) / 10
      }
    }
    if (Object.keys(fields).length === 0) return
    await saveMeasurement(date, fields)
    setDraft({})
    setShowEntry(false)
  }

  const hasData = ORDER.some((f) => measurements.some((m) => m[f] != null))

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mensurations</h2>
          <button
            type="button"
            onClick={() => setShowEntry((s) => !s)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            {showEntry ? 'Fermer' : 'Saisir'}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Le tour de taille (hebdo, au nombril, debout, fin d'expiration) bouge souvent
          quand la balance stagne — c'est un bon repère.
        </p>

        {showEntry && (
          <div className="mt-3 space-y-2">
            <input
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map((f) => (
                <div key={f} className="text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <span>{MEASURE_LABELS[f]} (cm)</span>
                    <button
                      type="button"
                      aria-label={`Comment mesurer : ${MEASURE_LABELS[f]}`}
                      aria-expanded={helpOpen === f}
                      onClick={() => setHelpOpen((cur) => (cur === f ? null : f))}
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] leading-none"
                    >
                      i
                    </button>
                  </div>
                  <input
                    inputMode="decimal"
                    value={draft[f] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                    className="mt-0.5 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm tabular-nums"
                  />
                  {helpOpen === f && (
                    <p className="mt-1 rounded-md bg-[var(--surface-2)] p-2 text-[11px] leading-snug">
                      {MEASURE_HELP[f]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Enregistrer
            </button>
          </div>
        )}
      </section>

      {!hasData ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune mensuration pour l'instant.
        </p>
      ) : (
        ORDER.map((f) => {
          const latest = measurements.find((m) => m[f] != null)
          if (!latest) return null
          const highlight = f === 'waistCm'
          return (
            <section
              key={f}
              className="rounded-xl border bg-[var(--surface)] p-3"
              style={{ borderColor: highlight ? 'var(--accent)' : 'var(--border)' }}
            >
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="text-sm font-medium">
                  {MEASURE_LABELS[f]}
                  {highlight && (
                    <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--accent)' }}>
                      à suivre
                    </span>
                  )}
                </h3>
                <span className="text-sm tabular-nums text-[var(--text-muted)]">
                  {fmtCm(latest[f] as number)} cm
                </span>
              </div>
              <MiniChart measurements={measurements} field={f} />
            </section>
          )
        })
      )}

      {measurements.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-2 text-sm font-semibold">Saisies</h3>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Pour corriger une erreur : re-saisir la même date fusionne les valeurs, ou
            supprime la saisie ci-dessous.
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {measurements.map((m) => {
              const summary = ORDER.filter((f) => m[f] != null)
                .map((f) => `${MEASURE_LABELS[f]} ${fmtCm(m[f] as number)}`)
                .join(' · ')
              return (
                <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-16 shrink-0 tabular-nums text-[var(--text-muted)]">
                    {m.date.slice(8)}/{m.date.slice(5, 7)}
                  </span>
                  <span className="flex-1 truncate text-xs text-[var(--text-muted)]">{summary}</span>
                  <button
                    type="button"
                    onClick={() => void deleteMeasurement(m.id)}
                    className="shrink-0 text-xs text-[var(--text-muted)] underline"
                  >
                    suppr.
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
