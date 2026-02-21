// Threshold Push Notification Service Worker

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // If JSON parsing fails, try text
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Threshold'
  const options = {
    body: data.body || 'Time to reach out to your network!',
    icon: '/logo.png',
    badge: '/favicon.png',
    data: data.url || '/dashboard',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen)
    })
  )
})
