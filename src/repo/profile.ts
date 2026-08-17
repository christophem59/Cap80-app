import { useSyncExternalStore } from 'react'
import type { Profile } from '../domain/types'
import { kvGet, kvSet } from '../db/db'
import { enqueueProfile } from '../db/outboxStore'
import { buildDefaultProfile } from '../sync/init'
import { mergeProfile } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'
import { nowIso } from '../domain/dates'

// Profil courant en mémoire (source de vérité UI = IndexedDB kv, §1.3). Par défaut,
// un profil §0 tant que rien n'a été chargé/tiré. Édition/poussée du profil : lot 7.

let profile: Profile = buildDefaultProfile()
let hydrated = false // true dès que loadProfileFromDb a été tenté (profil local à jour).
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
  }
  hydrated = true
  emit()
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

/**
 * Modifie le profil localement (updatedAt = maintenant) ET le pousse (profile.json
 * entier, §5.4). Utilisé par l'édition du programme et l'application d'un ajustement.
 */
export async function saveProfile(mutate: (p: Profile) => Profile): Promise<Profile> {
  const next = { ...mutate(profile), updatedAt: nowIso() }
  await setProfileLocal(next)
  await enqueueProfile(next)
  await refreshPending()
  void sync()
  return next
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

/** true dès que le profil local a été chargé depuis IndexedDB (évite d'afficher
 *  l'onboarding par erreur pendant l'hydratation au démarrage). */
export function useProfileHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => hydrated,
  )
}
