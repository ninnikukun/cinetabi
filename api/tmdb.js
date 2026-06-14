// Vercel サーバーレス関数：TMDB を呼び、APIキーを表に出さないための中継。
// フロントは /api/tmdb?action=search&q=... のように呼ぶ。
// 環境変数 TMDB_API_KEY が未設定なら { error: "no_key" } を返し、
// フロント側はデモデータにフォールバックする。

export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return res.status(200).json({ error: "no_key" });
  }

  const action = (req.query.action || "search").toString();
  const q = (req.query.q || "").toString();
  const id = (req.query.id || "").toString();

  const base = "https://api.themoviedb.org/3";
  const common = `api_key=${key}&language=ja-JP&region=JP`;

  let url;
  if (action === "search") {
    if (!q.trim()) return res.status(200).json({ results: [] });
    url = `${base}/search/movie?${common}&include_adult=false&query=${encodeURIComponent(q)}`;
  } else if (action === "popular") {
    url = `${base}/movie/popular?${common}&page=1`;
  } else if (action === "movie") {
    url = `${base}/movie/${encodeURIComponent(id)}?${common}`;
  } else {
    return res.status(400).json({ error: "bad_action" });
  }

  try {
    const r = await fetch(url);
    const data = await r.json();
    // CDN で1時間キャッシュ（同じ検索の呼び出しを減らす）
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(200).json({ error: "fetch_failed" });
  }
}
