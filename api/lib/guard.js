// 中継APIエンドポイント（/api/tmdb・/api/cinemas）向けの簡易的な悪用対策。
// このアプリの規模（個人開発・無料枠）に見合う最小限の対策であり、強固な保証はしない。
//
// isAllowedOrigin: ブラウザからの「クロスオリジンfetch」は必ずOriginヘッダーが付く
//   （Fetch仕様上の保証）ため、それが自分のホストと一致しない場合だけ拒否する。
//   Originヘッダーが無いリクエスト（curl・サーバー間連携・古いブラウザの同一オリジン
//   GET等）は判別できないため通す。「他サイトのJSから黙って呼ばれる」ことへの
//   抑止であり、認証の代わりにはならない。
//
// rateLimit: サーバーレス関数のインスタンス内メモリだけで完結する簡易実装。
//   コールドスタートやインスタンスが複数に分かれる場合は制限がリセットされる
//   （ベストエフォート）。本格的な保護が必要になったらVercel KV/Upstash等の
//   永続ストアに置き換えること。

export function isAllowedOrigin(req, extraAllowedHosts = []) {
  const origin = req.headers?.origin;
  if (!origin) return true; // 判別不能なリクエストは通す（rateLimit側で抑止する）
  try {
    const originHost = new URL(origin).host;
    const host = req.headers?.host;
    if (originHost === host) return true;
    if (extraAllowedHosts.includes(originHost)) return true;
  } catch {
    return false; // Originヘッダーの形式が不正なものは拒否
  }
  return false;
}

const buckets = new Map(); // "<key>:<ip>" -> { count, resetAt }

export function rateLimit(req, { max = 30, windowMs = 60_000, key = "" } = {}) {
  const fwd = req.headers?.["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(bucketKey);
  if (!entry || now > entry.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
