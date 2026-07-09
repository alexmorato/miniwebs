const CACHE_STATIC = "seguir-ruta-static-v3";
const CACHE_DYNAMIC = "seguir-ruta-dynamic-v3";

const STATIC_ASSETS = [
  "./seguir_ruta.html",
  "./ruteo.html",
  "./seguir_ruta.sw.js",
  "./gpx/nuria-coma-de-vaca-queralbs.gpx",
  "./mapa/map.osm",
  "./mapa/map2.osm",
  "./leaflet/dist/leaflet.css",
  "./leaflet/dist/leaflet.js",
  "./leaflet/dist/images/layers-2x.png",
  "./leaflet/dist/images/layers.png",
  "./leaflet/dist/images/marker-icon-2x.png",
  "./leaflet/dist/images/marker-icon.png",
  "./leaflet/dist/images/marker-shadow.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
        .map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isTile = /\/tiles\//.test(url.pathname) || /tile\.openstreetmap\.org/.test(url.hostname);
  const isHtmlNavigation = event.request.mode === "navigate"
    || (event.request.headers.get("accept") || "").includes("text/html");

  if (event.request.method !== "GET") {
    return;
  }

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./ruteo.html") || caches.match("./seguir_ruta.html")))
    );
    return;
  }

  if (isTile) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_DYNAMIC).then((cache) => cache.put(event.request, clone));
            return response;
          })
          .catch(() => caches.match("./seguir_ruta.html"));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const sameOrigin = url.origin === self.location.origin;
        if (sameOrigin) {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match("./seguir_ruta.html"))
  );
});