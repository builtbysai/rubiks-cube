/* Rubik's Cube offline shell. Cache-first for the app shell; the cube,
// solver, and all UI work without a network once installed.
//
// Updates never take over silently: a new worker precaches into "waiting"
// and only activates when the user accepts the in-app update prompt
// (the page posts { type: 'SKIP_WAITING' }). Checks run on load, hourly,
// and on tab visibility, so installed users actually receive new deploys. */
const CACHE = 'rubiks-cube-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './vendor/three/three.module.js',
  './vendor/three/geometries/RoundedBoxGeometry.js',
  './vendor/cube.js',
  './vendor/solve.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && new URL(e.request.url).origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
