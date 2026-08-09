import {
  getAllStoredRecords,
  putStoredRecord,
  getAllThumbnails,
  putThumbnail,
  kvGet,
  kvSet,
} from '../db/db'
import type { StoredRecord } from '../db/db'
import { nowIso } from '../domain/dates'

// §7.8 / §12.17 — Export complet en JSON et réimport. Un export réimporté dans une
// installation vierge restitue l'intégralité des données locales.

const APP = 'cap80'

interface Backup {
  app: string
  schemaVersion: number
  exportedAt: string
  profile: unknown
  customFoods: unknown
  customRecipes: unknown
  records: StoredRecord[]
  thumbnails: Record<string, string>
}

export async function buildBackup(): Promise<Backup> {
  return {
    app: APP,
    schemaVersion: 1,
    exportedAt: nowIso(),
    profile: (await kvGet('profile')) ?? null,
    customFoods: (await kvGet('customFoods')) ?? null,
    customRecipes: (await kvGet('customRecipes')) ?? null,
    records: await getAllStoredRecords(),
    thumbnails: await getAllThumbnails(),
  }
}

/** Télécharge l'export JSON complet. */
export async function exportBackup(): Promise<void> {
  const data = await buildBackup()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `cap80-export-${data.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Restaure un export dans IndexedDB. L'app se recharge ensuite. */
export async function importBackup(text: string): Promise<{ records: number }> {
  const data = JSON.parse(text) as Partial<Backup>
  if (data.app !== APP || !Array.isArray(data.records)) {
    throw new Error("Ce fichier n'est pas un export Cap80 valide.")
  }
  for (const row of data.records) await putStoredRecord(row)
  if (data.profile) await kvSet('profile', data.profile)
  if (data.customFoods) await kvSet('customFoods', data.customFoods)
  if (data.customRecipes) await kvSet('customRecipes', data.customRecipes)
  if (data.thumbnails) {
    for (const [id, url] of Object.entries(data.thumbnails)) await putThumbnail(id, url)
  }
  return { records: data.records.length }
}
