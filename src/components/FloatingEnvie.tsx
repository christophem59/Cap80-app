import { useLocation, useNavigate } from 'react-router-dom'

// §7.9 — Bouton permanent « Envie », atteignable depuis n'importe quel écran, au-dessus
// de la barre d'onglets. On nomme l'état, pas la faute : « Envie », jamais « craquage ».
export function FloatingEnvie() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (pathname === '/envie') return null // pas pendant le parcours lui-même

  return (
    <button
      type="button"
      onClick={() => navigate('/envie')}
      aria-label="Noter une envie"
      className="fixed right-4 z-20 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', background: 'var(--accent)' }}
    >
      <span className="text-base leading-none">＋</span> Envie
    </button>
  )
}
