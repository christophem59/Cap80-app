import { useSyncStatus } from '../sync/manager'
import type { SyncState } from '../sync/manager'

// Bandeau d'état de synchronisation, permanent et discret (§1.3), branché sur l'outbox.
// États : Synchronisé / N en attente / Hors-ligne / Synchronisation… / Erreur.

const DOT: Record<SyncState, string> = {
  synced: 'var(--ok)',
  syncing: 'var(--accent)',
  offline: 'var(--warn)',
  error: 'var(--alert)',
  unconfigured: 'var(--text-muted)',
}

function label(state: SyncState, pending: number): string {
  switch (state) {
    case 'synced':
      return 'Synchronisé'
    case 'syncing':
      return pending > 0 ? `Synchronisation… (${pending})` : 'Synchronisation…'
    case 'offline':
      return pending > 0 ? `Hors-ligne — ${pending} en attente` : 'Hors-ligne'
    case 'error':
      return pending > 0 ? `${pending} en attente` : 'Erreur de synchronisation'
    case 'unconfigured':
      return 'Dépôt non configuré'
  }
}

export function SyncBanner() {
  const { state, pending } = useSyncStatus()
  return (
    <div
      className="flex items-center gap-2 px-4 py-1 text-xs text-[var(--text-muted)]"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: DOT[state] }}
        aria-hidden="true"
      />
      <span>{label(state, pending)}</span>
    </div>
  )
}
