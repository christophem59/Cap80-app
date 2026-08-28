import { useRegisterSW } from 'virtual:pwa-register/react'

// §10 : quand un nouveau service worker est prêt, proposer un rechargement plutôt
// que de l'imposer (jamais de reload au milieu d'une saisie).
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // `immediate` : enregistrer sans attendre l'événement `load` de la page. Sinon
    // l'enregistrement dépend du moment où ce composant monte, ce qui est fragile.
    immediate: true,
    // Détecte les nouveaux déploiements sans attendre un redémarrage complet :
    // on redemande au SW de se mettre à jour à l'ouverture, périodiquement, et au
    // retour au premier plan.
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => registration.update().catch(() => {})
      check()
      setInterval(check, 60_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

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
