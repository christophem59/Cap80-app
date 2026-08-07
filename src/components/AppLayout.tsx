import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { SyncBanner } from './SyncBanner'
import { ReloadPrompt } from './ReloadPrompt'

export function AppLayout() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--bg)]">
      <Header />
      <SyncBanner />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
      <ReloadPrompt />
    </div>
  )
}
