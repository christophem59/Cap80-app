import type { Profile, SyncedRecord } from '../domain/types'

// §5.4 — Fusion appliquée ENREGISTREMENT PAR ENREGISTREMENT, jamais fichier par
// fichier. Un seul utilisateur, potentiellement deux appareils (téléphone + Mac).

/**
 * Fusionne deux jeux d'enregistrements du même fichier :
 *  - id présent des deux côtés  → on garde celui dont updatedAt est le plus récent ;
 *  - id présent d'un seul côté   → on le garde (ne JAMAIS supprimer implicitement) ;
 *  - une suppression est explicite via `deletedAt` (tombstone) : l'enregistrement
 *    reste dans le fichier, masqué dans l'interface.
 * En cas d'égalité stricte d'updatedAt, on conserve la version distante (déterministe).
 */
export function mergeRecords<T extends SyncedRecord>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  for (const r of remote) byId.set(r.id, r)
  for (const r of local) {
    const existing = byId.get(r.id)
    if (!existing || r.updatedAt > existing.updatedAt) byId.set(r.id, r)
  }
  return [...byId.values()]
}

/** Enregistrements visibles dans l'interface (tombstones exclus). */
export function visibleRecords<T extends SyncedRecord>(records: T[]): T[] {
  return records.filter((r) => !r.deletedAt)
}

/**
 * Cas particulier de profile.json (§5.4) : l'objet Profile n'a pas d'id et n'est pas
 * fusionnable enregistrement par enregistrement → le fichier entier dont l'updatedAt
 * est le plus récent gagne, en bloc. `remoteWon` sert à prévenir l'utilisateur si une
 * version distante plus récente écrase une modification locale du programme.
 */
export function mergeProfile(
  local: Profile,
  remote: Profile,
): { profile: Profile; remoteWon: boolean } {
  if (remote.updatedAt > local.updatedAt) return { profile: remote, remoteWon: true }
  return { profile: local, remoteWon: false }
}
