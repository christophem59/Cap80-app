import { useEffect, useState } from 'react'

// Chrono de repos (§7.4), déclenché à la validation d'une série. Bandeau bas d'écran,
// coloré et non bloquant : la couleur passe du bleu à l'orange puis au rouge à
// l'approche de la fin, puis vert quand c'est reparti.
export function RestBanner({
  endsAt,
  totalSeconds,
  onClose,
}: {
  endsAt: number
  totalSeconds: number
  onClose: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const remaining = Math.max(0, Math.round((endsAt - now) / 1000))
  const frac = Math.max(0, Math.min(1, remaining / totalSeconds)) // 1 au départ → 0 à la fin

  useEffect(() => {
    if (remaining === 0) {
      const t = setTimeout(onClose, 2000)
      return () => clearTimeout(t)
    }
  }, [remaining, onClose])

  // Couleur selon le temps restant : bleu → orange → rouge, vert à 0.
  const color =
    remaining === 0
      ? 'var(--ok)'
      : frac > 0.5
        ? 'var(--accent)'
        : frac > 0.2
          ? 'var(--warn)'
          : 'var(--alert)'

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md overflow-hidden rounded-xl shadow-lg"
      style={{ marginBottom: 'env(safe-area-inset-bottom)', background: color }}
      role="status"
      aria-live="off"
    >
      {/* Barre de progression du temps écoulé. */}
      <div className="h-1 w-full bg-black/20">
        <div
          className="h-full bg-white/70 transition-[width] duration-200"
          style={{ width: `${(1 - frac) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="text-sm font-medium">
          {remaining > 0 ? (
            <>
              Repos <span className="text-lg font-bold tabular-nums">{remaining}s</span>
            </>
          ) : (
            "C'est reparti 💪"
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium"
        >
          {remaining > 0 ? 'Passer' : 'OK'}
        </button>
      </div>
    </div>
  )
}
