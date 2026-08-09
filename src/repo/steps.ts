import { useEffect, useState } from 'react'
import type { StepEntry, LocalDate } from '../domain/types'
import { nowIso } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'

const FILE = 'steps.json'
const stepId = (date: LocalDate) => `${date}-steps`

export async function getSteps(): Promise<StepEntry[]> {
  const all = (await getRecordsByFile(FILE)) as StepEntry[]
  return visibleRecords(all).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Une saisie de pas par jour (id `${date}-steps`) : re-saisir remplace. */
export async function saveSteps(
  date: LocalDate,
  steps: number,
  source: StepEntry['source'] = 'manual',
): Promise<StepEntry> {
  const entry: StepEntry = { id: stepId(date), date, steps, source, updatedAt: nowIso() }
  await enqueueRecord(FILE, entry)
  await refreshPending()
  void sync()
  return entry
}

export async function deleteSteps(id: string): Promise<void> {
  const all = (await getRecordsByFile(FILE)) as StepEntry[]
  const found = all.find((r) => r.id === id)
  if (!found) return
  await enqueueRecord(FILE, { ...found, deletedAt: nowIso(), updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

/**
 * §9 — Import en masse des totaux journaliers (source 'health-import'). Ne remplace pas
 * une saisie manuelle sans confirmation explicite (`overwriteManual`). Un seul push
 * (coalescence sur steps.json).
 */
export async function importSteps(
  daily: { date: LocalDate; steps: number }[],
  overwriteManual: boolean,
): Promise<{ imported: number; skipped: number }> {
  const existing = (await getRecordsByFile(FILE)) as StepEntry[]
  const manualDates = new Set(
    existing.filter((e) => !e.deletedAt && e.source === 'manual').map((e) => e.date),
  )
  let imported = 0
  let skipped = 0
  for (const d of daily) {
    if (!overwriteManual && manualDates.has(d.date)) {
      skipped++
      continue
    }
    await enqueueRecord(FILE, {
      id: stepId(d.date),
      date: d.date,
      steps: Math.round(d.steps),
      source: 'health-import',
      updatedAt: nowIso(),
    } as StepEntry)
    imported++
  }
  await refreshPending()
  void sync()
  return { imported, skipped }
}

export function useSteps(): StepEntry[] {
  const [data, setData] = useState<StepEntry[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getSteps().then((s) => {
        if (alive) setData(s)
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
