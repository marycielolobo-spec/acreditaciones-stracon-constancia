// Guarda la app en el celular para usarla sin señal.
// La app (página e íconos) se sirve desde la copia guardada; datos.json se intenta bajar
// de internet y, si no hay señal o tarda, se usa la última copia guardada.
var VERSION = 'acr-app-mvn02cri';
var DATOS = 'acr-datos';
var ESPERA_MS = 4000;
var APP = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png'];

self.addEventListener('install', function (e) {
  // Los datos también se guardan desde la primera visita, para que funcione sin señal aunque no se vuelva a abrir con internet
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(function (c) { return c.addAll(APP); }),
    caches.open(DATOS).then(function (c) { return c.add(new Request('datos.json', { cache: 'no-store' })); })
  ]).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION && k !== DATOS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function copiaGuardada() {
  return caches.open(DATOS).then(function (c) { return c.match('datos.json'); }).then(function (r) {
    if (!r) return Response.error();
    return r.blob().then(function (b) {
      return new Response(b, { headers: { 'Content-Type': 'application/json', 'X-Desde-Cache': '1' } });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.endsWith('/datos.json')) {
    // Aunque se use la copia por demora, la descarga sigue y actualiza la copia para la próxima vez
    var red = fetch(e.request.url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      var copia = r.clone();
      caches.open(DATOS).then(function (c) { c.put('datos.json', copia); });
      return r;
    });
    var espera = new Promise(function (_, no) { setTimeout(no, ESPERA_MS); });
    e.waitUntil(red.catch(function () {}));
    e.respondWith(Promise.race([red, espera]).catch(copiaGuardada));
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).catch(function () {
      return e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error();
    });
  }));
});
