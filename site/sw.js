const CACHE = 'balcony-water-v5';
const ASSETS = ['./', 'index.html', 'style.css', 'fonts.css', 'app.js', 'manifest.webmanifest',
  'fonts/HankenGrotesk.woff2', 'fonts/IBMPlexMono-400.woff2', 'fonts/IBMPlexMono-500.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // weather/geocoding go straight to the network
  e.respondWith(
    // no-cache: revalidate instead of trusting the HTTP cache, so a fresh deploy isn't hidden for ~10 min
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
