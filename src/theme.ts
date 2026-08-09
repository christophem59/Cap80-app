// Gestionnaire de thème (§11) : bascule directe clair ↔ sombre. Par défaut, on part
// du réglage système tant que l'utilisateur n'a pas choisi ; ensuite c'est manuel et
// persistant. La classe `dark` sur <html> pilote Tailwind et les jetons CSS.
import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark'

const KEY = 'suivi.theme'
const listeners = new Set<() => void>()
const media = window.matchMedia('(prefers-color-scheme: dark)')

function hasStored(): boolean {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark'
}

function readPref(): ThemePref {
  const v = localStorage.getItem(KEY)
  if (v === 'light' || v === 'dark') return v
  return media.matches ? 'dark' : 'light' // défaut = système, résolu en concret
}

function apply(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', pref === 'dark')
}

/** Appelé une fois au démarrage, avant le premier rendu. */
export function initTheme() {
  apply(readPref())
  // Tant que l'utilisateur n'a pas choisi, on suit encore le système en direct.
  media.addEventListener('change', () => {
    if (!hasStored()) {
      apply(readPref())
      listeners.forEach((l) => l())
    }
  })
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(KEY, pref)
  apply(pref)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Hook React : renvoie le thème effectif (clair/sombre) et se re-rend au changement. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => 'light')
}
