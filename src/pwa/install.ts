import { useSyncExternalStore } from 'react'

// §10 — Installation PWA (beforeinstallprompt fonctionne sur Chrome Android) et
// stockage persistant (navigator.storage.persist(), best-effort : on lit le booléen).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Capturé au chargement du module (avant le rendu React), car l'événement peut se
// déclencher tôt. On empêche la mini-infobar et on garde l'événement pour un vrai geste.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  // Meilleur moment pour demander la persistance (§10).
  void navigator.storage?.persist?.()
  emit()
})

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice
  deferred = null
  emit()
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => deferred !== null && !isStandalone(),
    () => false,
  )
}

export async function requestPersist(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false
}

export async function isPersisted(): Promise<boolean> {
  return (await navigator.storage?.persisted?.()) ?? false
}

/** Quota/usage de stockage (pour l'affichage dans les réglages), en Mo. */
export async function storageEstimateMb(): Promise<{ usage: number; quota: number } | null> {
  const est = await navigator.storage?.estimate?.()
  if (!est || est.quota == null) return null
  return {
    usage: Math.round((est.usage ?? 0) / 1e6),
    quota: Math.round(est.quota / 1e6),
  }
}
