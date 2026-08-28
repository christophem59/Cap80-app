import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import './index.css'
import { router } from './router'
import { ReloadPrompt } from './components/ReloadPrompt'
import { initTheme } from './theme'
import './pwa/install' // capture beforeinstallprompt au plus tôt
import { startSync } from './sync/manager'

// Applique le thème avant le premier rendu pour éviter un flash clair→sombre.
initTheme()

// ReloadPrompt est monté ICI, à côté du routeur, et NON dans AppLayout : c'est lui qui
// enregistre le service worker (useRegisterSW). AppLayout ne rend rien tant que le profil
// n'est pas hydraté depuis IndexedDB, et rend l'onboarding tant qu'il n'est pas validé —
// ReloadPrompt montait donc APRÈS l'événement `load`, et l'écoute de `load` posée par
// vite-plugin-pwa ne se déclenchait jamais.
// Conséquence constatée sur le déploiement : AUCUN service worker enregistré, donc aucun
// cache hors-ligne et aucune proposition de mise à jour. Il n'utilise aucun hook de
// routeur : le placer hors du RouterProvider est sûr.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ReloadPrompt />
  </StrictMode>,
)

// Démarre la synchronisation (pull + vidage de l'outbox + écoute du réseau) après le
// rendu. L'UI reste utilisable même si tout échoue : elle lit IndexedDB (§1.3).
startSync()
