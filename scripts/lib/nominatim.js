import { sleep } from "./sleep.js";
import { USER_AGENT } from "./user-agent.js";

// Nominatimで地名・POI名を検索し、最上位1件を返す。1件もヒットしなければnull。
// delayMs: リクエスト前に待機する時間（Nominatimの1リクエスト/秒ポリシー対策）。
//   ループ内で連続呼び出しする場合に指定する。単発呼び出しなら省略でよい（0）。
export async function searchNominatim(query, { delayMs = 0, userAgent = USER_AGENT } = {}) {
  if (delayMs > 0) await sleep(delayMs);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&countrycodes=jp&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { "User-Agent": userAgent, "Accept-Language": "ja" } });
  if (!r.ok) return null;
  const d = await r.json();
  return Array.isArray(d) && d.length > 0 ? d[0] : null;
}
