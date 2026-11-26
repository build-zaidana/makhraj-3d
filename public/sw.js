const CACHE_NAME = 'makhraj-3d-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        './',
        './favicon.svg',
        './manifest.webmanifest',
        './models/anatomy_head_1to1.glb',
        './models/facecap.glb',
        './basis/basis_transcoder.js',
        './basis/basis_transcoder.wasm',
      ]).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Heavy immutable assets (3D GLB, audio MP3, Basis WASM): cache-first for instant offline playback
  const isMediaAsset =
    url.pathname.includes('/models/') ||
    url.pathname.includes('/audio/') ||
    url.pathname.includes('/basis/');

  if (isMediaAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        });
      })
    );
    return;
  }

  // App shell & JS/CSS: network-first so updates land immediately, with offline cache fallback
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
  );
});
