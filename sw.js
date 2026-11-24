const CACHE_NAME = "tim-gia-tri-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./daily.html",
  "./compare.html",
  "./account.html",
  "./workshop.html",
  "./privacy.html",
  "./manifest.webmanifest",
  "./assets/css/style.css",
  "./assets/js/config.js",
  "./assets/js/billing-core.js",
  "./assets/js/growth-core.js",
  "./assets/js/daily-core.js",
  "./assets/js/data.js",
  "./assets/js/app.js",
  "./assets/js/share-card.js",
  "./assets/js/analytics.js",
  "./assets/js/native-reminders.js",
  "./assets/js/auth.js",
  "./assets/js/pro.js",
  "./assets/js/daily-page.js",
  "./assets/js/compare-page.js",
  "./assets/js/workshop-page.js",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Chỉ cache tài nguyên cùng origin; bỏ qua API Supabase
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
