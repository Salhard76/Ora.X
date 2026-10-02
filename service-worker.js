/* Ora X 11.0 · 𝑺𝒂𝒍𝑯𝒂𝒓𝒅 */
const CACHE = "orax-11.0";
const FILES = ["./", "./index.html", "./style-11-0.css", "./app-11-0.js", "./manifest-11-0.json", "./icon-192.png", "./icon-512.png", "./icon-192-maskable.png", "./icon-512-maskable.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(FILES.map(file =>
        fetch(file, { cache: "reload" }).then(response => {
          if (!response.ok) throw new Error("cache " + file);
          return cache.put(file, response);
        })
      )))
      .catch(error => {
        console.error("Ora X: installazione cache fallita", error);
        throw error;
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("orax-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ignoreSearch: le icone sono richieste come "icon-192.png?v=<versione>" ma in cache sono salvate senza query.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())
    )
  );
});
