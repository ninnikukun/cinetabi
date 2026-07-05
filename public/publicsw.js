const CACHE = "cinetabi-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// ネットワーク優先。オフラインの時だけキャッシュ（トップページのみ）にフォールバック。
// TMDB/Supabase等のAPI呼び出しは素通しし、古いデータを誤って出さないようにする。
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match("/"))
  );
});
