import { useSyncExternalStore } from 'react'
import type { SyncedRecord } from '../domain/types'
import { GitHubClient, SyncAuthError } from './github'
import { getRepoConfig, getToken, isConfigured } from './config'
import { processOutbox } from './outbox'
import { parseRecordsEnvelope, parseProfileEnvelope } from './files'
import { mergeRecords } from './merge'
import { countPending, getRecordsByFile, setSha, kvSet } from '../db/db'
import { emitRecordsChanged } from '../db/events'
import { dbOutboxStore, applyPulledRecords } from '../db/outboxStore'
import { loadProfileFromDb, reconcileRemoteProfile } from '../repo/profile'
import type { Profile } from '../domain/types'

// Orchestration de la synchronisation (§1.3, §5.6). IndexedDB reste la source de
// vérité ; le manager ne fait que pousser l'outbox et tirer/réconcilier au démarrage.

export type SyncState = 'unconfigured' | 'offline' | 'syncing' | 'synced' | 'error'

export interface SyncStatus {
  state: SyncState
  pending: number
  lastError?: string
}

// Fichiers d'enregistrements tirés au démarrage (lot 3 : le poids ; les autres
// s'ajouteront dans leurs lots).
const PULL_FILES = [
  'weights.json',
  'measurements.json',
  'workouts.json',
  'photos/index.json',
]

let status: SyncStatus = { state: 'unconfigured', pending: 0 }
const listeners = new Set<() => void>()
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = 0

function emit() {
  listeners.forEach((l) => l())
}

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  emit()
}

function getClient(): GitHubClient | null {
  const cfg = getRepoConfig()
  const token = getToken()
  if (!cfg || !token) return null
  return new GitHubClient({ ...cfg, token })
}

export async function refreshPending(): Promise<void> {
  setStatus({ pending: await countPending() })
}

/** Tire et réconcilie les fichiers du dépôt distant vers IndexedDB (§5.4). */
export async function pullAndReconcile(): Promise<void> {
  const client = getClient()
  if (!client || !navigator.onLine) return
  for (const file of PULL_FILES) {
    const res = await client.getFile(file)
    if (res.status !== 'present') continue
    const remote = parseRecordsEnvelope(res.text) as SyncedRecord[]
    const local = await getRecordsByFile(file)
    await applyPulledRecords(file, mergeRecords(local, remote))
    await setSha(file, res.sha)
  }
  // Profil : fichier entier le plus récent gagne (§5.4).
  const prof = await client.getFile('profile.json')
  if (prof.status === 'present') {
    await reconcileRemoteProfile(parseProfileEnvelope(prof.text) as Profile)
    await setSha('profile.json', prof.sha)
  }

  // Catalogues perso (enrichissement futur) → kv, fusionnés à la base au runtime (§4).
  for (const [file, key] of [
    ['custom-foods.json', 'customFoods'],
    ['custom-recipes.json', 'customRecipes'],
  ] as const) {
    const r = await client.getFile(file)
    if (r.status === 'present') {
      await kvSet(key, parseRecordsEnvelope(r.text))
      await setSha(file, r.sha)
      emitRecordsChanged(file)
    }
  }

  // Repas : mois courant + mois précédent (partition §3).
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const months = [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`,
  ]
  for (const m of months) {
    const file = `meals/${m}.json`
    const r = await client.getFile(file)
    if (r.status === 'present') {
      const remote = parseRecordsEnvelope(r.text) as SyncedRecord[]
      const local = await getRecordsByFile(file)
      await applyPulledRecords(file, mergeRecords(local, remote))
      await setSha(file, r.sha)
    }
  }
}

function scheduleRetry() {
  if (retryTimer) return
  retryDelay = retryDelay === 0 ? 5_000 : Math.min(retryDelay * 2, 300_000) // cap 5 min
  retryTimer = setTimeout(() => {
    retryTimer = null
    void sync()
  }, retryDelay)
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryDelay = 0
}

/** Vide l'outbox. Idempotent, sûr à appeler en concurrence (garde dans processOutbox). */
export async function sync(): Promise<void> {
  if (!isConfigured()) {
    setStatus({ state: 'unconfigured', pending: await countPending() })
    return
  }
  if (!navigator.onLine) {
    setStatus({ state: 'offline', pending: await countPending() })
    return
  }
  const client = getClient()!
  setStatus({ state: 'syncing', lastError: undefined })
  try {
    await processOutbox(client, dbOutboxStore)
    const pending = await countPending()
    if (pending === 0) {
      clearRetry()
      setStatus({ state: 'synced', pending })
    } else {
      // Des entrées restent (échecs transitoires) : on retentera avec backoff.
      setStatus({ state: 'error', pending })
      scheduleRetry()
    }
  } catch (err) {
    const msg = err instanceof SyncAuthError ? err.message : "Échec de synchronisation"
    setStatus({ state: 'error', pending: await countPending(), lastError: msg })
    // Sur erreur d'auth, ne pas boucler (§5.2) ; sur le reste, retenter avec backoff.
    if (!(err instanceof SyncAuthError)) scheduleRetry()
  }
}

/** À appeler une fois au démarrage : pull, puis push, puis écoute des événements. */
export function startSync(): void {
  window.addEventListener('online', () => void sync())
  void (async () => {
    await loadProfileFromDb() // profil persistant disponible avant le pull
    try {
      await pullAndReconcile()
    } catch {
      // Le pull peut échouer hors-ligne : sans conséquence, l'UI lit IndexedDB.
    }
    await refreshPending()
    await sync()
  })()
}

// ---- Hook React pour le badge ----

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => status,
  )
}
