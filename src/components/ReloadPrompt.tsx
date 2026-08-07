import { useRegisterSW } from 'virtual:pwa-register/react'

// §10 : quand un nouveau service worker est prêt, proposer un rechargement plutôt
// que de l'imposer (jamais de reload au milieu d'une saisie).
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 bottom-20 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="alert"
    >
      <span className="text-sm">Une nouvelle version est disponible.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
        >
          Plus tard
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          Recharger
        </button>
      </div>
    </div>
  )
}
