// Service worker: permite abrir la app sin internet (los datos ya viven en el dispositivo)
const VERSION = 'gv-v2.1.1';
const CORE = ['./', './index.html', './app.js', './styles.css', './config.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/script\.google|googleusercontent|drive\.google|tile\.openstreetmap/.test(u.hostname)) return; // siempre red
  // archivos propios: red primero (así cada actualización en GitHub llega de inmediato), caché si no hay internet
  const redPrimero = u.origin === location.origin;
  if (redPrimero) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // resto (app.js, estilos, librerías CDN): caché primero y se actualiza en segundo plano
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; }).catch(() => cached);
    return cached || net;
  }));
});
