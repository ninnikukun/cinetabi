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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ページ本体（ナビゲーション）はネットワーク優先。オフラインの時だけキャッシュ（トップページ）にフォールバック。
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  // /api/（cinemas.js・tmdb.js）とクロスオリジン（Supabase等）は素通し。
  // 古い検索結果・古いデータを誤ってオフラインで返さないよう、キャッシュ対象にしない。
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // それ以外の同一オリジンGET（ビルド成果物のJS/CSS・アイコン等）はキャッシュ優先。
  // 無ければ取得してキャッシュに保存し、次回オフラインでも使えるようにする。
  // ※ ビルドごとにファイル名がハッシュ化されるため、事前の一覧登録ではなく
  //   実際にリクエストされたものを都度キャッシュする方式にしている。
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
