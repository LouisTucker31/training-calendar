// Bump this whenever any cached file changes, so old clients pick up the
// new version instead of serving stale cached copies indefinitely.
const CACHE_NAME = "training-calendar-v11";

const CACHE_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./supabase.js",
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

// Cache-first for the static app shell only - training data now lives in
// Supabase, a live backend, so requests to it must always hit the network
// (never served from cache) or the app would show stale events/workouts
// forever and silently fail to sync logged-workout state.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).hostname.endsWith(".supabase.co")) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
