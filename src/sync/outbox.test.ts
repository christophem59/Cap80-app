import { describe, it, expect } from 'vitest'
import type { SyncedRecord, WeightEntry } from '../domain/types'
import type { OutboxEntry } from '../db/db'
import type { GetFileResult } from './github'
import { SyncConflictError, SyncAuthError } from './github'
import { processOutbox } from './outbox'
import type { SyncClient, OutboxStore } from './outbox'
import { base64ToUtf8 } from './base64'
import { parseRecordsEnvelope } from './files'

function weight(day: number): WeightEntry {
  const date = `2026-08-${String(day).padStart(2, '0')}`
  return { id: `${date}-weight`, date, weightKg: 100 - day * 0.1, updatedAt: `${date}T07:00:00Z` }
}

function recordEntry(r: WeightEntry): OutboxEntry {
  return {
    id: `ob-${r.id}`,
    file: 'weights.json',
    kind: 'record',
    recordId: r.id,
    recordJson: JSON.stringify(r),
    attempts: 0,
    state: 'pending',
    createdAt: r.updatedAt,
  }
}

// Store en mémoire pour les tests.
class FakeStore implements OutboxStore {
  pending: OutboxEntry[]
  records: SyncedRecord[]
  sha = new Map<string, string>()
  retried: { id: string; error: string }[] = []
  constructor(records: WeightEntry[]) {
    this.records = [...records]
    this.pending = records.map(recordEntry)
  }
  async listPending() {
    return this.pending.filter((e) => e.state === 'pending')
  }
  async recordsForFile() {
    return this.records
  }
  async getSha(file: string) {
    return this.sha.get(file)
  }
  async setSha(file: string, sha: string) {
    this.sha.set(file, sha)
  }
  async markDone(ids: string[]) {
    this.pending = this.pending.filter((e) => !ids.includes(e.id))
  }
  async markRetry(entry: OutboxEntry, error: string) {
    this.retried.push({ id: entry.id, error })
  }
}

describe('processOutbox — coalescence (§5.3 / §12.6)', () => {
  it('dix pesées hors-ligne → un seul GET et un seul PUT contenant les dix', async () => {
    const store = new FakeStore(Array.from({ length: 10 }, (_, i) => weight(i + 1)))
    let gets = 0
    let puts = 0
    let putBody = ''
    const client: SyncClient = {
      async getFile(): Promise<GetFileResult> {
        gets++
        return { status: 'absent' }
      },
      async putFile(_path, base64) {
        puts++
        putBody = base64
        return { sha: 'sha-1' }
      },
      async deleteFile() {},
    }

    const res = await processOutbox(client, store)

    expect(gets).toBe(1)
    expect(puts).toBe(1)
    expect(res).toEqual({ pushedFiles: 1, pushedEntries: 10, failed: 0 })
    // Le PUT contient bien les 10 enregistrements fusionnés.
    expect(parseRecordsEnvelope(base64ToUtf8(putBody))).toHaveLength(10)
    // L'outbox est vidée et le sha mémorisé.
    expect(await store.listPending()).toHaveLength(0)
    expect(store.sha.get('weights.json')).toBe('sha-1')
  })

  it('fusionne avec les enregistrements distants existants', async () => {
    const store = new FakeStore([weight(2)])
    const remote = { schemaVersion: 1, records: [weight(1)] }
    const client: SyncClient = {
      async getFile(): Promise<GetFileResult> {
        return { status: 'present', text: JSON.stringify(remote), sha: 'old' }
      },
      async putFile(_p, base64) {
        expect(parseRecordsEnvelope(base64ToUtf8(base64)).map((r) => (r as WeightEntry).id).sort()).toEqual([
          '2026-08-01-weight',
          '2026-08-02-weight',
        ])
        return { sha: 'new' }
      },
      async deleteFile() {},
    }
    await processOutbox(client, store)
  })

  it('rejoue le PUT après un conflit de sha, puis réussit', async () => {
    const store = new FakeStore([weight(1)])
    let puts = 0
    const client: SyncClient = {
      async getFile(): Promise<GetFileResult> {
        return { status: 'present', text: JSON.stringify({ schemaVersion: 1, records: [] }), sha: 's' }
      },
      async putFile() {
        puts++
        if (puts === 1) throw new SyncConflictError()
        return { sha: 'ok' }
      },
      async deleteFile() {},
    }
    const res = await processOutbox(client, store)
    expect(puts).toBe(2)
    expect(res.failed).toBe(0)
    expect(await store.listPending()).toHaveLength(0)
  })

  it('une erreur d’authentification arrête la sync sans vider l’outbox', async () => {
    const store = new FakeStore([weight(1)])
    const client: SyncClient = {
      async getFile(): Promise<GetFileResult> {
        throw new SyncAuthError()
      },
      async putFile() {
        return { sha: 'x' }
      },
      async deleteFile() {},
    }
    await expect(processOutbox(client, store)).rejects.toBeInstanceOf(SyncAuthError)
    expect(await store.listPending()).toHaveLength(1)
  })
})
