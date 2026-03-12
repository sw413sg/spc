const CACHE_NAME = 'spc-v1.4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Estrategia mixta (Network First para HTML, Cache First para estáticos)
self.addEventListener('fetch', event => {
  // 1. Si la petición es de navegación (ej. cargando el index.html principal)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Hay internet: Obtenemos la última versión de GitHub, la actualizamos en el caché y la mostramos.
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => {
          // No hay internet (offline): Buscamos en el caché la última versión guardada.
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Para el resto de archivos (imágenes, json), usamos Cache First para mayor velocidad.
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SPC';
  const options = {
    body: data.body || 'Actualización de carga',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'silo-update',
    renotify: true,
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length > 0) {
        return list[0].focus();
      }
      return clients.openWindow('./');
    })
  );
});
