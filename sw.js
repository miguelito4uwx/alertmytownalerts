// AlertMyTown service worker
//
// This file only does anything once index.html + sw.js are hosted together
// on a real HTTPS origin. Inside the Claude artifact preview, the registration
// call in index.html has nothing to attach to and fails silently — that's
// expected, not a bug.
//
// What this gives you in a real deployment:
//   - Basic app-shell caching (offline load of the UI)
//   - A "push" listener stub — but note this alone does NOT deliver push
//     notifications. Real push additionally requires:
//       1. The user granting Notification permission
//       2. registration.pushManager.subscribe() creating a PushSubscription
//       3. Your own backend storing that subscription and calling a push
//          service (e.g. the `web-push` npm package with VAPID keys)
//          whenever the NWS alert feed changes for that user
//   None of that backend exists here — this is scaffolding, not a working
//   push pipeline.

const CACHE_NAME = 'alertmytown-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell; everything else (live NWS/radar/geocoding
// requests) always goes to the network so alerts are never served stale.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'AlertMyTown', body: event.data ? event.data.text() : 'A weather alert was issued.' };
  }
  const title = data.title || 'AlertMyTown';
  const options = {
    body: data.body || 'A new weather alert was issued for your location.',
    tag: data.tag || 'alertmytown-push',
    requireInteraction: !!data.urgent,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      if (clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
