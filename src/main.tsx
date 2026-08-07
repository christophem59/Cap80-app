import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { initTheme } from './theme'
import { startSync } from './sync/manager'

// Applique le thème avant le premier rendu pour éviter un flash clair→sombre.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// Démarre la synchronisation (pull + vidage de l'outbox + écoute du réseau) après le
// rendu. L'UI reste utilisable même si tout échoue : elle lit IndexedDB (§1.3).
startSync()
