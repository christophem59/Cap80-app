import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { SyncBanner } from './SyncBanner'
import { FloatingEnvie } from './FloatingEnvie'
import { Onboarding } from '../pages/Onboarding'
import { useProfile, useProfileHydrated } from '../repo/profile'

export function AppLayout() {
  const hydrated = useProfileHydrated()
  const profile = useProfile()

  // Tant que le profil local n'est pas chargé, on n'affiche rien (évite un flash
  // d'onboarding chez un utilisateur déjà démarré).
  if (!hydrated) {
    return <div className="min-h-[100svh] bg-[var(--bg)]" />
  }

  // Profil pas encore validé → écran de démarrage (saisie des infos + reset).
  if (!profile.onboarded) {
    return <Onboarding />
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--bg)]">
      <Header />
      <SyncBanner />
      {/* Le padding bas réserve la place du bouton « Envie », qui est en position fixe :
          sans lui, il recouvre la fin du contenu et rend intouchable ce qui s'y trouve
          (constaté sur le bouton « suppr. » du dernier item d'un repas).
          --envie-space est publiée par FloatingEnvie, et vaut 0 quand il est masqué. */}
      <main
        className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4"
        style={{ paddingBottom: 'calc(1rem + var(--envie-space, 96px))' }}
      >
        <Outlet />
      </main>
      <FloatingEnvie />
      <BottomNav />
    </div>
  )
}
