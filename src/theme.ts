// Gestionnaire de thème (§11) : suit le réglage système par défaut, avec une
// bascule manuelle qui persiste. La classe `dark` sur <html> pilote Tailwind et
// les jetons CSS d'index.css.
import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'suivi.theme'
const listeners = new Set<() => void>()
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readPref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function effectiveDark(pref: ThemePref): boolean {
  return pref === 'dark' || (pref === 'system' && media.matches)
}

function apply(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', effectiveDark(pref))
}

/** Appelé une fois au démarrage, avant le premier rendu. */
export function initTheme() {
  apply(readPref())
  // Quand on est en mode « système », suivre les changements de l'OS en direct.
  media.addEventListener('change', () => {
    if (readPref() === 'system') {
      apply('system')
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

/** Hook React : renvoie la préférence courante et se re-rend à chaque changement. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => 'system')
}
