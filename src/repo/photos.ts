import { useEffect, useState } from 'react'
import type { PhotoEntry, PhotoAngle, LocalDate } from '../domain/types'
import { nowIso } from '../domain/dates'
import { getRecordsByFile, getThumbnail, putThumbnail } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord, enqueueBinary } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'
import { processPhoto, makeThumbnail } from '../util/image'
import { getRepoConfig, getToken } from '../sync/config'
import { GitHubClient } from '../sync/github'

const FILE = 'photos/index.json'

export const ANGLES: PhotoAngle[] = ['face', 'profil', 'dos']
export const ANGLE_LABELS: Record<PhotoAngle, string> = {
  face: 'Face',
  profil: 'Profil',
  dos: 'Dos',
}

export async function getPhotos(): Promise<PhotoEntry[]> {
  const all = (await getRecordsByFile(FILE)) as PhotoEntry[]
  return visibleRecords(all).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * §5.5 — Enregistre une photo : redimensionne (<300 Ko, orientation EXIF corrigée),
 * garde une vignette locale (≤200 px), pousse le binaire via l'outbox et référence la
 * photo dans photos/index.json. La pleine résolution n'est PAS conservée en local (§1.3).
 */
export async function savePhoto(
  date: LocalDate,
  angle: PhotoAngle,
  input: Blob,
  weightKgAtDate: number | null,
): Promise<PhotoEntry> {
  const { blob, width, height } = await processPhoto(input)
  const path = `photos/${date}--${angle}.jpg`
  const id = `${date}-${angle}`
  await putThumbnail(id, await makeThumbnail(blob))
  await enqueueBinary(path, blob)
  const entry: PhotoEntry = {
    id,
    date,
    angle,
    path,
    widthPx: width,
    heightPx: height,
    bytes: blob.size,
    weightKgAtDate,
    updatedAt: nowIso(),
  }
  await enqueueRecord(FILE, entry)
  await refreshPending()
  void sync()
  return entry
}

export async function deletePhoto(id: string): Promise<void> {
  const all = (await getRecordsByFile(FILE)) as PhotoEntry[]
  const found = all.find((r) => r.id === id)
  if (!found) return
  await enqueueRecord(FILE, { ...found, deletedAt: nowIso(), updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

/** Charge la pleine résolution à la demande depuis git (non conservée en local). */
export async function fetchFullResUrl(path: string): Promise<string | null> {
  const cfg = getRepoConfig()
  const token = getToken()
  if (!cfg || !token) return null
  const bytes = await new GitHubClient({ ...cfg, token }).getFileBytes(path)
  if (!bytes) return null
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))
}

export function usePhotos(): PhotoEntry[] {
  const [data, setData] = useState<PhotoEntry[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getPhotos().then((p) => {
        if (alive) setData(p)
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

export function useThumbnail(id: string): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    void getThumbnail(id).then((t) => {
      if (alive) setUrl(t)
    })
    return () => {
      alive = false
    }
  }, [id])
  return url
}
