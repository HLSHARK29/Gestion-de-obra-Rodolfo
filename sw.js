const CACHE_NAME = 'reporte-financiero-v1';
const ASSETS = [
  './index.html',
  './historial.js',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css'
];

// Instalación: Guarda los recursos iniciales y fuerza la activación inmediata
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: Limpia cachés antiguas para que los cambios de diseño, logo o scripts se reflejen de inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de red con respaldo en caché (Network First)
// Esto asegura que el navegador siempre busque la versión más reciente en la red (como tu logo o archivos actualizados), 
// y solo use el caché si no hay conexión a internet.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la red responde correctamente, clonamos la respuesta para actualizar el caché en segundo plano
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si no hay internet, se entrega lo que esté guardado en caché
        return caches.match(event.request);
      })
  );
});