/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Service worker custom (mode injectManifest). Il conserve le précache hors-ligne de
// Workbox et ajoute la gestion des notifications push (rappels envoyés par le workflow
// GitHub Actions du dépôt privé, cf. push-backend/).

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

// Précache du bundle (injecté au build par vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

// Flux « nouvelle version → recharger » (registerType: 'prompt') : on n'active le
// nouveau SW que lorsque l'app le demande explicitement.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {}
  try {
    payload = (event.data?.json() as PushPayload) ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }
  const scope = self.registration.scope
  const icon = payload.icon ?? new URL('icon-192.png', scope).href
  const title = payload.title ?? 'Cap80'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon,
      badge: icon,
      tag: payload.tag ?? 'cap80',
      data: { url: payload.url ?? scope },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const scope = self.registration.scope
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? scope
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        // Une fenêtre de l'app est déjà ouverte : on la ramène au premier plan.
        if ('focus' in client) {
          await (client as WindowClient).focus()
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target)
    })(),
  )
})
