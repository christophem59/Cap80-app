import type { SyncedRecord } from '../domain/types'
import type { OutboxStore } from '../sync/outbox'
import { MAX_ATTEMPTS } from '../sync/outbox'
import { nowIso } from '../domain/dates'
import { emitRecordsChanged } from './events'
import type { OutboxEntry } from './db'
import {
  putRecord,
  putRecords,
  getRecordsByFile,
  addOutbox,
  allOutbox,
  updateOutbox,
  deleteOutbox,
  getSha,
  setSha,
} from './db'

/** OutboxStore réel, adossé à IndexedDB (§1.3). */
export const dbOutboxStore: OutboxStore = {
  async listPending() {
    return (await allOutbox()).filter((e) => e.state === 'pending')
  },
  recordsForFile(file: string) {
    return getRecordsByFile(file)
  },
  getSha(file: string) {
    return getSha(file)
  },
  setSha(file: string, sha: string) {
    return setSha(file, sha)
  },
  markDone(ids: string[]) {
    return deleteOutbox(ids)
  },
  async markRetry(entry: OutboxEntry, error: string) {
    const attempts = entry.attempts + 1
    await updateOutbox({
      ...entry,
      attempts,
      lastError: error,
      // §5.3 : au-delà de MAX_ATTEMPTS, on bascule en `failed` (écran « Problèmes »).
      state: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
    })
  },
}

/**
 * Écrit un enregistrement en local ET le met en file d'attente (§1.3 : chaque écriture
 * part immédiatement dans l'outbox). L'id d'outbox est déterministe par (fichier,
 * enregistrement) : ré-éditer le même jour remplace l'entrée au lieu d'en créer une
 * seconde.
 */
export async function enqueueRecord(file: string, record: SyncedRecord): Promise<void> {
  await putRecord(file, record)
  await addOutbox({
    id: `rec:${file}:${record.id}`,
    file,
    kind: 'record',
    recordId: record.id,
    recordJson: JSON.stringify(record),
    attempts: 0,
    state: 'pending',
    createdAt: nowIso(),
  })
  emitRecordsChanged(file)
}

/** Applique des enregistrements fusionnés venus du pull, sans les remettre en outbox. */
export async function applyPulledRecords(file: string, records: SyncedRecord[]): Promise<void> {
  await putRecords(file, records)
  emitRecordsChanged(file)
}

/**
 * Met en file un binaire (photo JPEG déjà redimensionnée < 300 Ko) pour un chemin
 * donné (§5.3). L'id est déterministe par chemin : re-capturer le même jour/angle
 * remplace l'entrée. Le blob vit dans l'outbox et en sera retiré après succès.
 */
export async function enqueueBinary(path: string, blob: Blob): Promise<void> {
  await addOutbox({
    id: `bin:${path}`,
    file: path,
    kind: 'binary',
    blob,
    attempts: 0,
    state: 'pending',
    createdAt: nowIso(),
  })
}
