import { useMemo, useState } from 'react'
import type { WeightEntry, WeightFlag } from '../domain/types'
import { todayLocal } from '../domain/dates'
import { saveWeight, useWeights } from '../repo/weights'

const FLAG_LABELS: Record<WeightFlag, string> = {
  repas_sale: 'Repas salé',
  alcool: 'Alcool',
  mauvais_sommeil: 'Mauvais sommeil',
  seance_veille: 'Séance la veille',
  constipation: 'Constipation',
  maladie: 'Maladie',
}

function parseKg(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
}

/** Poids de référence pour la vraisemblance : la pesée juste avant la date choisie. */
function previousWeight(weights: WeightEntry[], date: string): number | null {
  const before = weights.filter((w) => w.date < date)
  return before.length ? before[0].weightKg : null
}

export function WeightEntryForm({
  onSaved,
  compact = false,
}: {
  onSaved?: (e: WeightEntry) => void
  compact?: boolean
}) {
  const weights = useWeights() // triées récent → ancien
  const last = weights[0]?.weightKg
  const [date, setDate] = useState(todayLocal())
  const [value, setValue] = useState('')
  const [flags, setFlags] = useState<Set<WeightFlag>>(new Set())
  const [showFlags, setShowFlags] = useState(false)
  const [saved, setSaved] = useState(false)

  // Préremplit avec la dernière pesée connue tant que l'utilisateur n'a rien tapé.
  const shown = value !== '' ? value : last != null ? last.toFixed(1).replace('.', ',') : ''
  const kg = parseKg(shown)

  const warning = useMemo(() => {
    if (kg == null) return null
    const ref = previousWeight(weights, date)
    if (ref != null && Math.abs(kg - ref) > 2) {
      return `Écart de ${Math.abs(kg - ref).toFixed(1).replace('.', ',')} kg avec la pesée précédente — faute de frappe ?`
    }
    return null
  }, [kg, weights, date])

  function step(delta: number) {
    const base = kg ?? last ?? 0
    setValue((Math.round((base + delta) * 10) / 10).toFixed(1).replace('.', ','))
    setSaved(false)
  }

  async function handleSave() {
    if (kg == null) return
    const entry = await saveWeight(date, kg, {
      flags: flags.size ? [...flags] : undefined,
    })
    setSaved(true)
    setValue('')
    setFlags(new Set())
    setShowFlags(false)
    onSaved?.(entry)
  }

  function toggleFlag(f: WeightFlag) {
    setFlags((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Diminuer de 0,1 kg"
          onClick={() => step(-0.1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xl"
        >
          −
        </button>
        <div className="relative flex-1">
          <input
            inputMode="decimal"
            aria-label="Poids en kilogrammes"
            value={shown}
            placeholder="97,4"
            onChange={(e) => {
              setValue(e.target.value)
              setSaved(false)
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-center text-3xl font-semibold tabular-nums"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
            kg
          </span>
        </div>
        <button
          type="button"
          aria-label="Augmenter de 0,1 kg"
          onClick={() => step(0.1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xl"
        >
          +
        </button>
      </div>

      {!compact && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Date de la pesée"
            value={date}
            max={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowFlags((s) => !s)}
            className="text-sm text-[var(--text-muted)] underline"
          >
            {flags.size ? `${flags.size} contexte(s)` : 'Ajouter un contexte'}
          </button>
        </div>
      )}

      {showFlags && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FLAG_LABELS) as WeightFlag[]).map((f) => {
            const active = flags.has(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFlag(f)}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs',
                  active
                    ? 'border-transparent text-white'
                    : 'border-[var(--border)] text-[var(--text-muted)]',
                ].join(' ')}
                style={active ? { background: 'var(--accent)' } : undefined}
              >
                {FLAG_LABELS[f]}
              </button>
            )
          })}
        </div>
      )}

      {warning && (
        <p className="text-xs" style={{ color: 'var(--warn)' }}>
          {warning}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={kg == null}
        className="w-full rounded-xl py-3 text-base font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        {saved ? 'Enregistré ✓' : 'Enregistrer la pesée'}
      </button>
    </div>
  )
}
