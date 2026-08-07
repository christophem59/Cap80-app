import { useSyncExternalStore } from 'react'
import type { Profile } from '../domain/types'
import { kvGet, kvSet } from '../db/db'
import { buildDefaultProfile } from '../sync/init'
import { mergeProfile } from '../sync/merge'
import { nowIso } from '../domain/dates'

// Profil courant en mémoire (source de vérité UI = IndexedDB kv, §1.3). Par défaut,
// un profil §0 tant que rien n'a été chargé/tiré. Édition/poussée du profil : lot 7.

let profile: Profile = buildDefaultProfile()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getProfile(): Profile {
  return profile
}

/** Charge le profil persistant depuis IndexedDB au démarrage. */
export async function loadProfileFromDb(): Promise<void> {
  const stored = await kvGet<Profile>('profile')
  if (stored) {
    profile = stored
    emit()
  }
}

/** Écrit le profil en local (kv) sans le pousser. Utilisé par le pull et l'init. */
export async function setProfileLocal(next: Profile): Promise<void> {
  profile = next
  await kvSet('profile', next)
  emit()
}

/**
 * Réconcilie un profil distant avec le local (§5.4 : fichier entier le plus récent
 * gagne). Renvoie remoteWon pour prévenir l'utilisateur (avertissement câblé au lot 7).
 */
export async function reconcileRemoteProfile(remote: Profile): Promise<{ remoteWon: boolean }> {
  const { profile: winner, remoteWon } = mergeProfile(profile, remote)
  if (remoteWon) await setProfileLocal(winner)
  return { remoteWon }
}

/** Marque le profil modifié localement (updatedAt). Poussée réelle : lot 7. */
export async function touchProfile(mutate: (p: Profile) => Profile): Promise<void> {
  await setProfileLocal({ ...mutate(profile), updatedAt: nowIso() })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    subscribe,
    () => profile,
    () => profile,
  )
}
