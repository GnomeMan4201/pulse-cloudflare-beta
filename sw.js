const CACHE = 'pulse-static-v4';
const ASSETS = ['./', './index.html', './app.js', './polish.js', './styles.css', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const reqUrl = new URL(req.url);
  if (reqUrl.pathname.startsWith('/api/')) return;
  if (req.method !== 'GET') return;
  if (req.headers.has('Authorization')) return;

  e.respondWith(
    fetch(req).then((res) => {
      if (res.headers.has('Set-Cookie')) return res;
      if (!res.ok) return res;
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req))
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'purge-legacy-caches') {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  }
});
