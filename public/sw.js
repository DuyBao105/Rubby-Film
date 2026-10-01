// RubyFilm Progressive Web App (PWA) Service Worker
const CACHE_NAME = "rubyfilm-cache-v3";
const PRECACHE_ASSETS = [
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Install: precache static icon assets only (NEVER precache dynamic HTML "/")
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

// Activate: aggressively wipe out old corrupted caches
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

// Fetch: bypass Next.js internal scripts & dynamic APIs entirely to prevent chunk corruption
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Bypass Next.js internal chunks, APIs, media streams & third-party CDNs
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".m3u8") ||
    url.pathname.endsWith(".ts") ||
    url.pathname.endsWith(".js") ||
    url.hostname.includes("phimimg.com") ||
    url.hostname.includes("tmdb.org") ||
    url.hostname.includes("hcaptcha")
  ) {
    return;
  }

  // 2. Navigation requests: always Network-First
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return new Response(
          "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>RubyFilm - Mất kết nối</title><style>body{margin:0;background:#0d0f12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}button{background:#e50000;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:16px}</style></head><body><div><h2>Không có kết nối mạng</h2><p>Vui lòng kiểm tra lại Wifi hoặc 4G/5G của bạn.</p><button onclick='location.reload()'>Thử lại</button></div></body></html>",
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      })
    );
    return;
  }

  // 3. Static icon cache fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
