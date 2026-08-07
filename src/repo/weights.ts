import { useEffect, useState } from 'react'
import type { WeightEntry, WeightFlag, LocalDate } from '../domain/types'
import { nowIso } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'

const FILE = 'weights.json'

/** Pesées visibles (tombstones exclus), les plus récentes d'abord. */
export async function getWeights(): Promise<WeightEntry[]> {
  const all = (await getRecordsByFile(FILE)) as WeightEntry[]
  return visibleRecords(all).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * Enregistre (ou remplace) la pesée d'un jour. Une pesée par jour : l'id est
 * `${date}-weight`, donc re-peser le même jour met à jour l'enregistrement. Écrit
 * immédiatement en local, empile dans l'outbox, puis tente une synchro (§1.3).
 */
export async function saveWeight(
  date: LocalDate,
  weightKg: number,
  opts?: { flags?: WeightFlag[]; note?: string },
): Promise<WeightEntry> {
  const entry: WeightEntry = {
    id: `${date}-weight`,
    date,
    weightKg,
    updatedAt: nowIso(),
    ...(opts?.flags?.length ? { flags: opts.flags } : {}),
    ...(opts?.note ? { note: opts.note } : {}),
  }
  await enqueueRecord(FILE, entry)
  await refreshPending()
  void sync()
  return entry
}

/** Suppression = tombstone (§5.4) : conservé dans le fichier, masqué dans l'UI. */
export async function deleteWeight(id: string): Promise<void> {
  const all = (await getRecordsByFile(FILE)) as WeightEntry[]
  const found = all.find((r) => r.id === id)
  if (!found) return
  await enqueueRecord(FILE, { ...found, deletedAt: nowIso(), updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

/** Hook réactif : pesées visibles, rechargées à chaque écriture locale ou pull. */
export function useWeights(): WeightEntry[] {
  const [data, setData] = useState<WeightEntry[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getWeights().then((w) => {
        if (alive) setData(w)
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
