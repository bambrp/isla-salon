/* Isla's Salon service worker. The build fills in VERSION and FILES (see vite.config.ts). */
const VERSION = '5f6a8abfbd0a';
const FILES = ["./","apple-touch-icon.png","assets/CanvasPool-CkeNae42.js","assets/RenderTargetSystem-K7_PPJk-.js","assets/browserAll-ZNZaXYuf.js","assets/getTexelRangeRects-DlBU4lqS.js","assets/index-CnKQ0Igc.css","assets/index-D1IZ-cGA.js","assets/init-3WnUq3aj.js","assets/webworkerAll-IQVIjbAf.js","icon-192.png","icon-512.png","icon-maskable-512.png","icon.svg","index.html","manifest.webmanifest"];
const CACHE = `islas-salon-${VERSION}`;

self.addEventListener('install', (event) => {
  // Keep every file of this build, then take over as soon as it is all safely stored.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('islas-salon-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Stored copy first, so it opens at once and works offline; the network only fills gaps.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)),
  );
});
