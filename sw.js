/**
 * sw.js — offline service worker.
 *
 * Strategy: pre-cache the whole app shell on install, then answer every same-origin GET
 * stale-while-revalidate (cached copy immediately, refreshed in the background). The app makes no
 * cross-origin requests, so anything off-origin is ignored.
 *
 * IMPORTANT: bump CACHE whenever a file in SHELL changes, otherwise returning visitors keep the old
 * version until their second reload.
 */
const CACHE = 'cogarcade-v8';
/**
 * Browsers refuse to serve a response whose `redirected` flag is set to a navigation request
 * (net::ERR_FAILED). Hosts such as Cloudflare redirect /index.html to /, so every response is
 * re-wrapped without the flag before it is cached or served.
 */
const clean = (res) =>
  res.redirected
    ? res
        .blob()
        .then(
          (b) =>
            new Response(b, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            }),
        )
    : res;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './src/runtime.js',
  './src/engine.js',
  './src/games.js',
  './src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            fetch(url)
              .then((res) => (res.ok ? clean(res) : null))
              .then((res) => res && cache.put(url, res))
              .catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            Promise.resolve(clean(copy)).then((c) =>
              caches.open(CACHE).then((cache) => cache.put(req, c)),
            );
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return clean(cached);
      }
      return refresh.then(
        (res) => res || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()),
      );
    }),
  );
});
