import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { SyncedRecord, Timestamp } from '../domain/types'

// IndexedDB est la source de vérité de l'interface (§1.3). Toute lecture d'écran
// vient d'ici ; aucune lecture réseau à l'affichage.

/** Une entrée d'outbox = une MUTATION d'un enregistrement (pas un instantané de
 *  fichier), imposé par la boucle de refusion du §5.2/§5.3. */
export interface OutboxEntry {
  id: string
  file: string // 'weights.json', 'meals/2026-08.json', 'photos/2026-08-17--face.jpg'
  kind: 'record' | 'binary' | 'delete-file'
  recordId?: string // pour kind 'record'
  recordJson?: string // l'enregistrement complet, sérialisé
  blob?: Blob // pour kind 'binary' : le JPEG déjà redimensionné
  attempts: number
  lastError?: string
  state: 'pending' | 'failed'
  createdAt: Timestamp
}

interface StoredRecord {
  pk: string // `${file}::${id}`
  file: string
  id: string
  record: SyncedRecord
}

interface SuiviDB extends DBSchema {
  records: { key: string; value: StoredRecord; indexes: { 'by-file': string } }
  outbox: {
    key: string
    value: OutboxEntry
    indexes: { 'by-file': string; 'by-state': string }
  }
  fileMeta: { key: string; value: { file: string; sha: string } }
  kv: { key: string; value: unknown }
  // Vignettes de photos (≤ 200 px), seule trace locale des photos (§1.3 / §5.5).
  thumbnails: { key: string; value: string }
}

const DB_NAME = 'suivi'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<SuiviDB>> | null = null

export function getDb(): Promise<IDBPDatabase<SuiviDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SuiviDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const records = db.createObjectStore('records', { keyPath: 'pk' })
          records.createIndex('by-file', 'file')
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
          outbox.createIndex('by-file', 'file')
          outbox.createIndex('by-state', 'state')
          db.createObjectStore('fileMeta', { keyPath: 'file' })
          db.createObjectStore('kv')
        }
        if (oldVersion < 2) {
          db.createObjectStore('thumbnails')
        }
      },
    })
  }
  return dbPromise
}

// ---- Vignettes ----

export async function putThumbnail(id: string, dataUrl: string): Promise<void> {
  const db = await getDb()
  await db.put('thumbnails', dataUrl, id)
}

export async function getThumbnail(id: string): Promise<string | undefined> {
  const db = await getDb()
  return db.get('thumbnails', id)
}

const pk = (file: string, id: string) => `${file}::${id}`

// ---- Enregistrements ----

export async function putRecord(file: string, record: SyncedRecord): Promise<void> {
  const db = await getDb()
  await db.put('records', { pk: pk(file, record.id), file, id: record.id, record })
}

export async function putRecords(file: string, records: SyncedRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('records', 'readwrite')
  await Promise.all([
    ...records.map((r) => tx.store.put({ pk: pk(file, r.id), file, id: r.id, record: r })),
    tx.done,
  ])
}

export async function getRecordsByFile(file: string): Promise<SyncedRecord[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('records', 'by-file', file)
  return rows.map((r) => r.record)
}

// ---- Outbox ----

export async function addOutbox(entry: OutboxEntry): Promise<void> {
  const db = await getDb()
  await db.put('outbox', entry)
}

export async function allOutbox(): Promise<OutboxEntry[]> {
  const db = await getDb()
  return db.getAll('outbox')
}

export async function countPending(): Promise<number> {
  const db = await getDb()
  const all = await db.getAll('outbox')
  return all.filter((e) => e.state === 'pending').length
}

export async function updateOutbox(entry: OutboxEntry): Promise<void> {
  const db = await getDb()
  await db.put('outbox', entry)
}

export async function deleteOutbox(ids: string[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
}

// ---- Sha des fichiers ----

export async function getSha(file: string): Promise<string | undefined> {
  const db = await getDb()
  return (await db.get('fileMeta', file))?.sha
}

export async function setSha(file: string, sha: string): Promise<void> {
  const db = await getDb()
  await db.put('fileMeta', { file, sha })
}

// ---- kv ----

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get('kv', key)) as T | undefined
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('kv', value, key)
}
