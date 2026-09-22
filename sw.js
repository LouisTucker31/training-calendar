// Bump this whenever any cached file changes, so old clients pick up the
// new version instead of serving stale cached copies indefinitely.
const CACHE_NAME = "training-calendar-v1";

const CACHE_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))
    )
  );
  self.clients.claim();
});

// Cache-first: this is a static app with no live data of its own, so a
// cached copy is always safe to serve immediately - falls back to the
// network for anything not yet cached (or after a cache-name bump).
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
