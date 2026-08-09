import { useEffect, useState } from 'react'
import type { SnackLog, SnackTrigger, SnackContext, LocalDate } from '../domain/types'
import { todayLocal, addDays, nowIso } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'

/** Épisodes partitionnés par mois, comme les repas (§3). */
export function snackFile(date: LocalDate): string {
  return `snacks/${date.slice(0, 7)}.json`
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Crée l'épisode dès le 1er tap : l'heure enregistrée est celle-ci (§12 bis). */
export async function createSnack(
  trigger: SnackTrigger,
  context: SnackContext,
): Promise<SnackLog> {
  const now = new Date()
  const date = todayLocal()
  const time = hhmm(now)
  const log: SnackLog = {
    id: `${date}-${time.replace(':', '')}-${Math.floor(Math.random() * 1e6)}`,
    date,
    time,
    trigger,
    context,
    outcome: null,
    updatedAt: nowIso(),
  }
  await enqueueRecord(snackFile(date), log)
  await refreshPending()
  void sync()
  return log
}

export async function updateSnack(log: SnackLog): Promise<void> {
  await enqueueRecord(snackFile(log.date), { ...log, updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

export async function deleteSnack(log: SnackLog): Promise<void> {
  await enqueueRecord(snackFile(log.date), {
    ...log,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
  })
  await refreshPending()
  void sync()
}

/** Tous les épisodes visibles des ~3 derniers mois (restitution §7.10). */
export async function getAllSnacks(today: LocalDate = todayLocal()): Promise<SnackLog[]> {
  const files = [
    ...new Set([snackFile(today), snackFile(addDays(today, -31)), snackFile(addDays(today, -62))]),
  ]
  const rows: SnackLog[] = []
  for (const f of files) rows.push(...((await getRecordsByFile(f)) as SnackLog[]))
  return visibleRecords(rows).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.time < b.time ? 1 : -1,
  )
}

export function useSnacks(): SnackLog[] {
  const [data, setData] = useState<SnackLog[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getAllSnacks().then((s) => {
        if (alive) setData(s)
      })
    }
    load()
    const today = todayLocal()
    const offs = [
      snackFile(today),
      snackFile(addDays(today, -31)),
      snackFile(addDays(today, -62)),
    ].map((f) => onRecordsChanged(f, load))
    return () => {
      alive = false
      offs.forEach((off) => off())
    }
  }, [])
  return data
}
