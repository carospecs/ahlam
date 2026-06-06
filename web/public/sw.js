// Minimal service worker — makes Ahlam installable and gives the app shell a
// basic offline fallback. Intentionally conservative: it only intercepts page
// navigations (network-first, falling back to the cached shell) so it never
// interferes with Next.js build assets or API calls.
const CACHE = "ahlam-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/")).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match("/").then((r) => r || Response.error()))
  );
});
