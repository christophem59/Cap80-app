import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// §7.9 — Bouton permanent « Envie », atteignable depuis n'importe quel écran, au-dessus
// de la barre d'onglets. On nomme l'état, pas la faute : « Envie », jamais « craquage ».

/**
 * Le bouton est en position fixe : sans réservation de place, il RECOUVRE la fin du
 * contenu. Constaté en vrai — le bouton « suppr. » du dernier item d'un repas passait
 * dessous et devenait intouchable.
 *
 * On publie donc sa hauteur dans `--envie-space`, que la zone de contenu ajoute à son
 * padding bas (voir AppLayout). Mesuré plutôt que codé en dur : le bouton grandit avec
 * la taille de police du système, et une constante finirait par mentir.
 *
 * Le décalage : le bouton est posé 72 px au-dessus du bord, la barre d'onglets en fait
 * ~56 — il déborde donc d'environ 16 px dans la zone scrollable, plus une marge de
 * confort de 8 px.
 */
const DEBORDEMENT_PX = 24

export function FloatingEnvie() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const masque = pathname === '/envie' // pas pendant le parcours lui-même
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const racine = document.documentElement
    if (masque) {
      racine.style.setProperty('--envie-space', '0px')
      return
    }
    const el = ref.current
    if (!el) return
    const sync = () => {
      racine.style.setProperty('--envie-space', `${el.offsetHeight + DEBORDEMENT_PX}px`)
    }
    sync()
    // ResizeObserver plutôt qu'une mesure unique : au montage, les polices ne sont pas
    // encore chargées et le bouton est plus petit qu'il ne le sera. Il grandit aussi avec
    // la taille de texte du système et au changement d'orientation. Observer la boîte
    // réelle couvre les trois cas sans les énumérer.
    const observateur = new ResizeObserver(sync)
    observateur.observe(el)
    return () => {
      observateur.disconnect()
      racine.style.setProperty('--envie-space', '0px')
    }
  }, [masque])

  if (masque) return null

  return (
    <button
      ref={ref}
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
