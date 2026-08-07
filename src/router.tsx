import { createHashRouter } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Today } from './pages/Today'
import { Tracking } from './pages/Tracking'
import { Meals } from './pages/Meals'
import { Workouts } from './pages/Workouts'
import { Program } from './pages/Program'
import { Settings } from './pages/Settings'
import { NotFound } from './pages/NotFound'

// Mode HASH imposé par le §2.1 : le mode history renvoie des 404 au rafraîchissement
// sur GitHub Pages. Le base path /suivi-app/ ne concerne que les assets, pas ces routes.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Today /> },
      { path: 'suivi', element: <Tracking /> },
      { path: 'repas', element: <Meals /> },
      { path: 'seances', element: <Workouts /> },
      { path: 'programme', element: <Program /> },
      { path: 'reglages', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
