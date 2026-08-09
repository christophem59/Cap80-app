import { unzipSync, strFromU8 } from 'fflate'
import { parseStepsCsv, aggregateDaily } from '../domain/healthImport'
import type { DailySteps } from '../domain/healthImport'

// Décompression du ZIP Takeout (fflate — DecompressionStream ne lit pas un ZIP) et
// extraction des pas. Navigateur uniquement.

/** Date locale YYYY-MM-DD à partir d'un ISO UTC (fuseau du navigateur). */
function localDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface ImportResult {
  daily: DailySteps[]
  sources: string[]
  csvFiles: number
  /** Noms des entrées du ZIP (pour diagnostic si aucun CSV de pas trouvé). */
  entries: string[]
}

export function importStepsFromZip(bytes: Uint8Array): ImportResult {
  const files = unzipSync(bytes)
  const names = Object.keys(files)
  // Fichiers mensuels de pas : Physical Activity…/steps_YYYY-MM-DD.csv
  const csvNames = names.filter((n) => /physical activity.*steps_.*\.csv$/i.test(n))

  const rows = csvNames.flatMap((n) => parseStepsCsv(strFromU8(files[n])))
  const daily = aggregateDaily(rows, localDate)
  const sources = [...new Set(rows.map((r) => r.source))]
  return { daily, sources, csvFiles: csvNames.length, entries: names.sort() }
}
