// Bump only when the ASSETS list changes. App code (HTML/JS/CSS) is served
// network-first, so a normal deploy reaches users without touching this.
const CACHE_NAME = 'mal-translate-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './about.html',
  './privacy.html',
  './terms.html',
  './pages.css',
  './pages.js'
];

// How long to wait for the network before falling back to the cached copy
const NETWORK_TIMEOUT_MS = 4000;

// Install Event - Pre-cache Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      // Bypass the HTTP cache so a new version never precaches stale files
      return cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== FONT_CACHE && key !== SHARE_CACHE) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// App code that must stay fresh after a deploy
function isAppCode(request, url) {
  return request.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
}

function putInCache(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

// Network-first: fresh code when online, cached copy when offline or the network is too slow
function networkFirst(request) {
  const network = fetch(request, { cache: 'no-cache' }).then((response) => putInCache(request, response));

  const cached = () => caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    .then((hit) => hit || (request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  const timeout = new Promise((resolve) => {
    setTimeout(() => cached().then((hit) => { if (hit) resolve(hit); }), NETWORK_TIMEOUT_MS);
  });

  return Promise.race([
    network.catch(() => cached().then((hit) => hit || Promise.reject(new Error('Offline and not cached')))),
    timeout
  ]);
}

// Cache-first with background refresh, for static assets (icons, manifest)
function staleWhileRevalidate(request) {
  return caches.match(request).then((cachedResponse) => {
    const network = fetch(request).then((response) => putInCache(request, response));
    if (cachedResponse) {
      network.catch(() => {/* Ignore network errors offline */});
      return cachedResponse;
    }
    return network;
  });
}

// Google Fonts (CSS + font files) live in their own cache so the Malayalam font
// works offline after the first online visit. Kept across app cache bumps.
const FONT_CACHE = 'mal-translate-fonts-v1';
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

function fontCacheFirst(request) {
  return caches.open(FONT_CACHE).then((cache) =>
    cache.match(request).then((hit) => {
      const network = fetch(request).then((response) => {
        // Cross-origin stylesheet loads are opaque (status 0); fonts are CORS (200)
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
        }
        return response;
      });
      if (hit) {
        network.catch(() => {/* offline */});
        return hit;
      }
      return network;
    })
  );
}

// Web Share Target (manifest.json "share_target"): Android shares an image here as a
// multipart POST. Stash the file, then send the app to index.html to pick it up.
const SHARE_CACHE = 'mal-translate-share';
const SHARE_PATH = new URL('./share-target', self.location).pathname;
const SHARED_IMAGE_URL = new URL('./shared-image', self.location).href;

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.getAll('image').find((f) => f && typeof f !== 'string' && f.size > 0);
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARED_IMAGE_URL, new Response(file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' }
      }));
    }
  } catch (err) {
    console.error('[Service Worker] Could not read shared image:', err);
  }
  return Response.redirect('./index.html?shared=1', 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === SHARE_PATH) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method === 'GET' && FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(fontCacheFirst(request));
    return;
  }

  // Only handle GET requests for our own files
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(isAppCode(request, url) ? networkFirst(request) : staleWhileRevalidate(request));
});
