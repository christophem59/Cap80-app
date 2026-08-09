import { useMemo, useRef, useState } from 'react'
import { importStepsFromZip } from '../util/takeoutSteps'
import type { ImportResult } from '../util/takeoutSteps'
import { useSteps, importSteps } from '../repo/steps'

// §9 niveau 2 — Import des pas depuis un export Google Health / Fitbit (Takeout).
// Format reconnu : Physical Activity…/steps_YYYY-MM-DD.csv (timestamp, steps, source).
// Dédup par source (§9 point 3) faite dans le domaine. Aperçu avant import.

export function StepsImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const steps = useSteps()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const manualDates = useMemo(
    () => new Set(steps.filter((s) => s.source === 'manual').map((s) => s.date)),
    [steps],
  )

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    setDone(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setResult(importStepsFromZip(bytes))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire ce ZIP.')
    } finally {
      setBusy(false)
    }
  }

  async function doImport() {
    if (!result) return
    setBusy(true)
    const r = await importSteps(result.daily, overwrite)
    setBusy(false)
    setDone(`${r.imported} jour(s) importé(s)${r.skipped ? `, ${r.skipped} ignoré(s) (saisie manuelle conservée)` : ''}.`)
    setResult(null)
  }

  const total = result ? result.daily.reduce((s, d) => s + d.steps, 0) : 0
  const wouldSkip = result
    ? result.daily.filter((d) => !overwrite && manualDates.has(d.date)).length
    : 0

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Pas — import Google Health / Fitbit
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Charge un export Takeout (.zip). L'app lit les pas (fichiers mensuels), agrège par jour
        et, si plusieurs sources existent, ne garde que la plus élevée par jour (pas de double
        comptage). Aperçu avant d'importer.
      </p>

      <input ref={fileRef} type="file" accept=".zip,application/zip" onChange={onFile} className="hidden" />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        {busy ? 'Lecture…' : 'Choisir un export (.zip)'}
      </button>

      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}
      {done && (
        <p className="mt-2 text-sm" style={{ color: 'var(--ok)' }}>
          {done}
        </p>
      )}

      {result && result.daily.length > 0 && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="tabular-nums">
            <strong>{result.daily.length}</strong> jours de{' '}
            {result.daily[0].date} à {result.daily[result.daily.length - 1].date}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Total {total.toLocaleString('fr-FR')} pas · source(s) : {result.sources.join(', ') || '—'}
            {wouldSkip > 0 && ` · ${wouldSkip} jour(s) déjà saisis manuellement seront conservés`}
          </p>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Remplacer aussi les saisies manuelles
          </label>
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--text-muted)]">Aperçu (7 derniers jours)</summary>
            <ul className="mt-1 tabular-nums">
              {result.daily.slice(-7).map((d) => (
                <li key={d.date} className="flex justify-between py-0.5">
                  <span className="text-[var(--text-muted)]">{d.date}</span>
                  <span>{d.steps.toLocaleString('fr-FR')} pas</span>
                </li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            disabled={busy}
            onClick={doImport}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            Importer {result.daily.length} jour(s)
          </button>
        </div>
      )}

      {result && result.daily.length === 0 && (
        <div className="mt-3 text-sm">
          <p style={{ color: 'var(--warn)' }}>
            Aucun fichier de pas reconnu dans ce ZIP ({result.entries.length} entrées).
          </p>
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-[var(--text-muted)]">Voir les entrées</summary>
            <ul className="mt-1 max-h-48 overflow-auto break-all">
              {result.entries.slice(0, 200).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}
