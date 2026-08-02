// ─── AuthCraft Service Worker ──────────────────────────────
// Handles push notifications for "Login with Single Click" feature
// Allow/Deny actions are handled DIRECTLY from the notification popup

const CACHE_NAME = 'authcraft-sw-v3';

// ─── Install — Force immediate update ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ─── Push Event — Show notification ────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'AuthCraft',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || 'You have a new login request',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'auth-login-request',
    renotify: true,
    requireInteraction: true,
    data: data.data || {},
    actions: data.actions || [
      { action: 'approve', title: 'Allow' },
      { action: 'deny', title: 'Deny' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Login Request', options)
  );
});

// ─── Notification Click — Handle user response directly ────
// The user taps Allow or Deny on the notification popup itself
// No webpage is opened — the response is sent directly from the service worker
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action; // 'approve', 'deny', or '' (body click)

  notification.close();

  if (action === 'ok') {
    // Just close the notification (already done above)
    return;
  }

  if (action === 'approve' || action === 'deny') {
    // User tapped Allow/Deny directly on the notification
    const apiUrl = data.apiUrl || '';
    const endpoint = apiUrl ? `${apiUrl}/api/push-auth/respond` : '/api/push-auth/respond';

    event.waitUntil(
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: data.requestId,
          token: data.token,
          action: action,
        }),
      }).then(() => {
        // Show confirmation notification
        if (action === 'approve') {
          return self.registration.showNotification('Login Approved', {
            body: 'You have been signed in successfully.',
            icon: '/favicon.svg',
            tag: 'auth-response',
            requireInteraction: false,
          });
        } else {
          return self.registration.showNotification('Login Denied', {
            body: 'The login attempt has been blocked.',
            icon: '/favicon.svg',
            tag: 'auth-response',
            requireInteraction: false,
          });
        }
      }).catch((err) => {
        console.error('Failed to respond to push auth:', err);
        return self.registration.showNotification('Error', {
          body: 'Could not process your response. Please try again.',
          icon: '/favicon.svg',
          tag: 'auth-response',
          requireInteraction: false,
        });
      })
    );
  } else {
    // User clicked on the notification body (not the buttons)
    // Open the approve page as a fallback
    const url = data.url || '/push-approve';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Try to focus an existing window
        for (const client of windowClients) {
          if (client.url.includes('/push-approve') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// ─── Activate — Clean up old caches ────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});
