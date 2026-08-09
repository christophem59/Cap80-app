// §9 niveau 2 — Parseur de l'export pas « Google Health / Fitbit » (Takeout).
// Format observé sur un export réel : fichiers mensuels
//   Physical Activity_GoogleData/steps_YYYY-MM-DD.csv
// colonnes : timestamp (ISO UTC), steps (incrément sur la minute), data source.
// Fonctions pures et testées ; la conversion date locale est injectée (déterminisme).

export interface StepCsvRow {
  timestamp: string
  steps: number
  source: string
}

export interface DailySteps {
  date: string // YYYY-MM-DD local
  steps: number
  source: string
}

/** Parse un CSV `timestamp,steps,data source` (en-tête ignoré, CRLF géré). */
export function parseStepsCsv(text: string): StepCsvRow[] {
  const rows: StepCsvRow[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (i === 0 && /timestamp/i.test(line)) continue // en-tête
    const parts = line.split(',')
    if (parts.length < 2) continue
    const timestamp = parts[0].trim()
    const steps = parseInt(parts[1].trim(), 10)
    const source = (parts[2] ?? 'inconnu').trim()
    if (!timestamp || !Number.isFinite(steps)) continue
    rows.push({ timestamp, steps, source })
  }
  return rows
}

/**
 * §9 point 3 — Agrège en totaux journaliers SANS jamais additionner deux sources sur
 * les mêmes plages : on somme par (jour local × source), puis on ne retient, pour
 * chaque jour, QUE la source dont le total est le plus élevé. Évite de doubler/tripler
 * quand plusieurs apps écrivent des pas.
 */
export function aggregateDaily(
  rows: StepCsvRow[],
  toLocalDate: (iso: string) => string,
): DailySteps[] {
  const byDate = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const date = toLocalDate(r.timestamp)
    const bySource = byDate.get(date) ?? new Map<string, number>()
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.steps)
    byDate.set(date, bySource)
  }
  const out: DailySteps[] = []
  for (const [date, bySource] of byDate) {
    let best = { source: 'inconnu', steps: 0 }
    for (const [source, steps] of bySource) {
      if (steps > best.steps) best = { source, steps }
    }
    out.push({ date, steps: best.steps, source: best.source })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
