// RubyFilm Progressive Web App (PWA) Service Worker
const CACHE_NAME = "rubyfilm-cache-v1";
const PRECACHE_ASSETS = [
  "/",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Install: precache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Precache failed:", err);
      })
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: network first with offline fallback for navigation, cache-first for static icons
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip dynamic API, streaming video, or analytics requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".m3u8") ||
    url.pathname.endsWith(".ts") ||
    url.hostname.includes("phimimg.com") ||
    url.hostname.includes("tmdb.org") ||
    url.hostname.includes("hcaptcha")
  ) {
    return;
  }

  // Handle navigations and static resources
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      if (event.request.mode === "navigate") {
        const fallBack = await cache.match("/");
        if (fallBack) return fallBack;
      }
      return new Response("Mạng không khả dụng", {
        status: 503,
        statusText: "Network Unavailable",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
  );
});
