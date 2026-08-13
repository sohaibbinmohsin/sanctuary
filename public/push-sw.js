/* Checklist Web Push handlers for VitePWA generateSW (imported via workbox.importScripts).
 * Handles `push` display and `notificationclick` → open/focus /checklist.
 */
/* eslint-disable no-undef */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Sanctuary',
    body: '',
    url: '/checklist',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : payload.title,
        body: typeof parsed.body === 'string' ? parsed.body : payload.body,
        url:
          (parsed.data && typeof parsed.data.url === 'string'
            ? parsed.data.url
            : null) ||
          (typeof parsed.url === 'string' ? parsed.url : null) ||
          '/checklist',
      }
    }
  } catch {
    try {
      const text = event.data?.text?.()
      if (text) payload.body = text
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: payload.url || '/checklist' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path =
    (event.notification.data && event.notification.data.url) || '/checklist'
  const targetUrl = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            'url' in client &&
            typeof client.url === 'string' &&
            client.url.startsWith(self.location.origin) &&
            'focus' in client
          ) {
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(targetUrl).then((c) => (c || client).focus())
            }
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
        return undefined
      }),
  )
})
