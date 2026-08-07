import { useEffect, useState } from 'react'

// Chrono de repos (§7.4), déclenché à la validation d'une série. Bandeau bas d'écran,
// non bloquant : l'utilisateur peut l'ignorer ou passer directement.
export function RestBanner({ endsAt, onClose }: { endsAt: number; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const remaining = Math.max(0, Math.round((endsAt - now) / 1000))
  useEffect(() => {
    if (remaining === 0) {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [remaining, onClose])

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
    >
      <span className="text-sm">
        {remaining > 0 ? (
          <>
            Repos : <span className="font-semibold tabular-nums">{remaining} s</span>
          </>
        ) : (
          'Repos terminé — série suivante'
        )}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)]"
      >
        Passer
      </button>
    </div>
  )
}
