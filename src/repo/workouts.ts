import { useEffect, useState } from 'react'
import type { WorkoutSession } from '../domain/types'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'
import { nowIso } from '../domain/dates'

const FILE = 'workouts.json'

/** Séances visibles, les plus récentes d'abord. */
export async function getWorkouts(): Promise<WorkoutSession[]> {
  const all = (await getRecordsByFile(FILE)) as WorkoutSession[]
  return visibleRecords(all).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.updatedAt < b.updatedAt ? 1 : -1,
  )
}

export async function saveWorkout(session: WorkoutSession): Promise<void> {
  await enqueueRecord(FILE, { ...session, updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

export async function deleteWorkout(id: string): Promise<void> {
  const all = (await getRecordsByFile(FILE)) as WorkoutSession[]
  const found = all.find((r) => r.id === id)
  if (!found) return
  await enqueueRecord(FILE, { ...found, deletedAt: nowIso(), updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

export function useWorkouts(): WorkoutSession[] {
  const [data, setData] = useState<WorkoutSession[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getWorkouts().then((w) => {
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
