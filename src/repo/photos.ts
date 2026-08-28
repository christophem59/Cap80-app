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

/**
 * Reconstruit la vignette d'une photo à partir de l'ORIGINAL du dépôt, et la range en
 * local. Les vignettes ne sont jamais synchronisées (§1.3/§5.5) : après une
 * réinstallation, l'index des photos revient mais la grille reste vide alors que les
 * images sont bien dans git. C'est ce trou que cette fonction comble.
 *
 * Une passe par chemin à la fois : la grille monte des dizaines de vignettes d'un coup,
 * et sans cette garde on lancerait autant d'appels concurrents à l'API pour rien.
 */
const rebuilding = new Map<string, Promise<string | undefined>>()

async function rebuildThumbnail(id: string, path: string): Promise<string | undefined> {
  const running = rebuilding.get(id)
  if (running) return running
  const task = (async () => {
    const cfg = getRepoConfig()
    const token = getToken()
    if (!cfg || !token) return undefined
    try {
      const bytes = await new GitHubClient({ ...cfg, token }).getFileBytes(path)
      if (!bytes) return undefined
      const thumb = await makeThumbnail(new Blob([bytes], { type: 'image/jpeg' }))
      await putThumbnail(id, thumb)
      return thumb
    } catch {
      return undefined // hors-ligne ou token expiré : on réessaiera au prochain affichage
    } finally {
      rebuilding.delete(id)
    }
  })()
  rebuilding.set(id, task)
  return task
}

/**
 * Vignette d'une photo. `path` permet de la reconstruire depuis le dépôt quand elle
 * manque en local — c'est le cas sur un appareil fraîchement installé.
 */
export function useThumbnail(id: string, path?: string): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    void (async () => {
      const local = await getThumbnail(id)
      if (!alive) return
      if (local) {
        setUrl(local)
        return
      }
      if (!path) return
      const rebuilt = await rebuildThumbnail(id, path)
      if (alive && rebuilt) setUrl(rebuilt)
    })()
    return () => {
      alive = false
    }
  }, [id, path])
  return url
}
