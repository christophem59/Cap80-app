// Bus d'événements « le contenu d'un fichier a changé » (écriture locale ou pull),
// pour que l'UI (qui lit IndexedDB, §1.3) se rafraîchisse sans polling.

const listeners = new Map<string, Set<() => void>>()

export function onRecordsChanged(file: string, cb: () => void): () => void {
  const set = listeners.get(file) ?? new Set()
  set.add(cb)
  listeners.set(file, set)
  return () => set.delete(cb)
}

export function emitRecordsChanged(file: string): void {
  listeners.get(file)?.forEach((cb) => cb())
}
