const CACHE_PREFIX = "clocky-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=ipad-settings-v1",
  "./calculator.js",
  "./app.js?v=feedback-mailto-v1",
  "./pwa-register.js",
  "./manifest.webmanifest",
  "./assets/clocky-hero-office.jpeg",
  "./assets/icons/clocky-192.png",
  "./assets/icons/clocky-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/clocky-maskable-192.png",
  "./assets/icons/clocky-maskable-512.png"
];
const CACHEABLE_PATHS = new Set(APP_SHELL.map(path => new URL(path, self.location.href).pathname));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !CACHEABLE_PATHS.has(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
