import type { SyncedRecord, Profile } from '../domain/types'
import type { OutboxEntry } from '../db/db'
import type { GetFileResult } from './github'
import { SyncAuthError, SyncConflictError } from './github'
import { mergeRecords, mergeProfile } from './merge'
import {
  parseRecordsEnvelope,
  serializeRecordsEnvelope,
  parseProfileEnvelope,
  serializeProfileEnvelope,
} from './files'
import { utf8ToBase64, bytesToBase64 } from './base64'

// §5.3 — Traitement de l'outbox avec COALESCENCE : dix pesées hors-ligne ne doivent
// pas produire dix commits. On regroupe les entrées `pending` visant le même fichier,
// on fait un seul GET, une seule fusion, un seul PUT.

/** Nombre max de tentatives avant de basculer une entrée en `failed` (§5.3). */
export const MAX_ATTEMPTS = 10
/** Nombre de rejeux immédiats sur conflit de sha avant d'abandonner la passe (§5.2). */
const CONFLICT_RETRIES = 3

/** Sous-ensemble du client GitHub dont l'outbox a besoin (facilite les tests). */
export interface SyncClient {
  getFile(path: string): Promise<GetFileResult>
  putFile(path: string, contentBase64: string, message: string, sha?: string): Promise<{ sha: string }>
  deleteFile(path: string, sha: string, message: string): Promise<void>
}

/** Accès au stockage local dont l'outbox a besoin (implémenté par IndexedDB en réel). */
export interface OutboxStore {
  listPending(): Promise<OutboxEntry[]>
  recordsForFile(file: string): Promise<SyncedRecord[]>
  getSha(file: string): Promise<string | undefined>
  setSha(file: string, sha: string): Promise<void>
  markDone(ids: string[]): Promise<void>
  markRetry(entry: OutboxEntry, error: string): Promise<void>
}

export interface OutboxResult {
  pushedFiles: number
  pushedEntries: number
  failed: number
}

function groupByFile(entries: OutboxEntry[]): Map<string, OutboxEntry[]> {
  const map = new Map<string, OutboxEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.file) ?? []
    arr.push(e)
    map.set(e.file, arr)
  }
  return map
}

/** Message de commit lisible : le fichier forme le journal (§5.2). */
function commitMessage(file: string, count: number): string {
  if (file === 'weights.json') return count === 1 ? '1 pesée' : `${count} pesées`
  if (file === 'measurements.json') return `${count} mensuration${count > 1 ? 's' : ''}`
  if (file === 'steps.json') return `${count} saisie(s) de pas`
  if (file === 'adjustments.json') return `ajustement${count > 1 ? `s (${count})` : ''}`
  const base = file.split('/').pop() ?? file
  return `${base} : ${count} enregistrement(s)`
}

async function readRemoteRecords(
  client: SyncClient,
  file: string,
): Promise<{ records: SyncedRecord[]; sha?: string }> {
  const res = await client.getFile(file)
  if (res.status === 'present') {
    return { records: parseRecordsEnvelope(res.text) as SyncedRecord[], sha: res.sha }
  }
  // 'absent' ou 'empty' → le fichier n'existe pas encore : PUT sans sha (le premier PUT
  // sur un dépôt vide produit le commit initial, §5.2).
  return { records: [] }
}

/** Écrit un fichier d'enregistrements coalescé, avec rejeu sur conflit de sha. */
async function pushRecordFile(
  client: SyncClient,
  store: OutboxStore,
  file: string,
  entries: OutboxEntry[],
): Promise<void> {
  for (let attempt = 0; attempt <= CONFLICT_RETRIES; attempt++) {
    const local = await store.recordsForFile(file)
    const { records: remote, sha } = await readRemoteRecords(client, file)
    const merged = mergeRecords(local, remote)
    const body = utf8ToBase64(serializeRecordsEnvelope(merged))
    try {
      const put = await client.putFile(file, body, commitMessage(file, entries.length), sha)
      await store.setSha(file, put.sha)
      await store.markDone(entries.map((e) => e.id))
      return
    } catch (err) {
      if (err instanceof SyncConflictError && attempt < CONFLICT_RETRIES) {
        continue // sha périmé : on refait GET → fusion → PUT
      }
      throw err
    }
  }
}

/**
 * Pousse profile.json ENTIER (§5.4 : fichier le plus récent gagne, pas de fusion
 * enregistrement par enregistrement). Coalescé : une seule entrée 'profile' à la fois.
 */
async function pushProfile(
  client: SyncClient,
  store: OutboxStore,
  entry: OutboxEntry,
): Promise<void> {
  const local = JSON.parse(entry.recordJson ?? '{}') as Profile
  for (let attempt = 0; attempt <= CONFLICT_RETRIES; attempt++) {
    const res = await client.getFile(entry.file)
    let winner = local
    let sha: string | undefined
    if (res.status === 'present') {
      sha = res.sha
      const remote = parseProfileEnvelope(res.text) as Profile
      winner = mergeProfile(local, remote).profile
    }
    const body = utf8ToBase64(serializeProfileEnvelope(winner))
    try {
      const put = await client.putFile(entry.file, body, 'profil / programme', sha)
      await store.setSha(entry.file, put.sha)
      await store.markDone([entry.id])
      return
    } catch (err) {
      if (err instanceof SyncConflictError && attempt < CONFLICT_RETRIES) continue
      throw err
    }
  }
}

async function pushBinary(
  client: SyncClient,
  store: OutboxStore,
  entry: OutboxEntry,
): Promise<void> {
  if (!entry.blob) throw new Error(`Entrée binaire ${entry.id} sans blob`)
  const bytes = new Uint8Array(await entry.blob.arrayBuffer())
  const existing = await client.getFile(entry.file)
  const sha = existing.status === 'present' ? existing.sha : undefined
  const base = entry.file.split('/').pop() ?? entry.file
  const put = await client.putFile(entry.file, bytesToBase64(bytes), `photo : ${base}`, sha)
  await store.setSha(entry.file, put.sha)
  await store.markDone([entry.id])
}

async function pushDeleteFile(
  client: SyncClient,
  store: OutboxStore,
  entry: OutboxEntry,
): Promise<void> {
  const existing = await client.getFile(entry.file)
  if (existing.status === 'present') {
    await client.deleteFile(entry.file, existing.sha, `suppression : ${entry.file}`)
  }
  await store.markDone([entry.id])
}

let running = false

/**
 * Vide l'outbox en une passe. Séquentiel entre les groupes de fichiers (jamais deux
 * PUT concurrents sur le même fichier). Garde `running` pour l'idempotence si Background
 * Sync et le retry applicatif s'exécutent en concurrence (§5.6).
 */
export async function processOutbox(
  client: SyncClient,
  store: OutboxStore,
): Promise<OutboxResult> {
  if (running) return { pushedFiles: 0, pushedEntries: 0, failed: 0 }
  running = true
  try {
    const pending = await store.listPending()
    const groups = groupByFile(pending)
    const result: OutboxResult = { pushedFiles: 0, pushedEntries: 0, failed: 0 }

    for (const [file, entries] of groups) {
      try {
        if (entries[0].kind === 'record') {
          await pushRecordFile(client, store, file, entries)
        } else if (entries[0].kind === 'binary') {
          for (const e of entries) await pushBinary(client, store, e)
        } else if (entries[0].kind === 'profile') {
          for (const e of entries) await pushProfile(client, store, e)
        } else {
          for (const e of entries) await pushDeleteFile(client, store, e)
        }
        result.pushedFiles++
        result.pushedEntries += entries.length
      } catch (err) {
        if (err instanceof SyncAuthError) throw err // arrêter la sync, ne pas boucler
        const msg = err instanceof Error ? err.message : String(err)
        for (const e of entries) await store.markRetry(e, msg)
        result.failed += entries.length
      }
    }
    return result
  } finally {
    running = false
  }
}
