import { useEffect, useState } from 'react'
import type { BodyMeasurement, LocalDate } from '../domain/types'
import { nowIso } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'

const FILE = 'measurements.json'

export type MeasureField = 'waistCm' | 'neckCm' | 'chestCm' | 'armCm' | 'thighCm' | 'hipCm'

export const MEASURE_LABELS: Record<MeasureField, string> = {
  waistCm: 'Tour de taille',
  neckCm: 'Cou',
  chestCm: 'Poitrine',
  armCm: 'Bras',
  thighCm: 'Cuisse',
  hipCm: 'Hanches',
}

/** Comment prendre chaque mesure (aide affichée dans le formulaire). */
export const MEASURE_HELP: Record<MeasureField, string> = {
  waistCm:
    "Au nombril, debout, sans rentrer le ventre. Mètre bien horizontal, à la fin d'une expiration normale.",
  neckCm: "À la base du cou, juste sous la pomme d'Adam. Mètre horizontal, sans serrer.",
  chestCm:
    'Au niveau des mamelons, bras le long du corps, mètre horizontal dans le dos, fin d\'expiration.',
  armCm: 'Bras dominant contracté (biceps serré), au point le plus large.',
  thighCm: 'Au point le plus large de la cuisse, juste sous le pli des fessiers, poids réparti.',
  hipCm: 'Au point le plus large des fessiers, pieds joints, mètre horizontal.',
}

export async function getMeasurements(): Promise<BodyMeasurement[]> {
  const all = (await getRecordsByFile(FILE)) as BodyMeasurement[]
  return visibleRecords(all).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Une mesure par jour (id `${date}-body`) : re-saisir le même jour fusionne les champs. */
export async function saveMeasurement(
  date: LocalDate,
  fields: Partial<Record<MeasureField, number>>,
): Promise<BodyMeasurement> {
  const all = (await getRecordsByFile(FILE)) as BodyMeasurement[]
  const existing = all.find((m) => m.id === `${date}-body` && !m.deletedAt)
  const entry: BodyMeasurement = {
    ...existing,
    id: `${date}-body`,
    date,
    updatedAt: nowIso(),
    ...fields,
  }
  await enqueueRecord(FILE, entry)
  await refreshPending()
  void sync()
  return entry
}

export async function deleteMeasurement(id: string): Promise<void> {
  const all = (await getRecordsByFile(FILE)) as BodyMeasurement[]
  const found = all.find((r) => r.id === id)
  if (!found) return
  await enqueueRecord(FILE, { ...found, deletedAt: nowIso(), updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

export function useMeasurements(): BodyMeasurement[] {
  const [data, setData] = useState<BodyMeasurement[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getMeasurements().then((m) => {
        if (alive) setData(m)
      })
    }
    load()
    const off = onRecordsChanged(FILE, load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return data
}
