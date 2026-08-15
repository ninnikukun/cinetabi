// 記録の共有ページ用データ中継。service_role鍵でrecordsのRLSをバイパスし、
// 未ログインの相手にも「公開設定された1件の記録」だけを安全に返す。
//
// GET  /api/share?token=xxx           : 記録取得（パスワード不要モードのみ即返す。
//                                        パスワードが必要な場合は { needsPassword:true } のみ返す）
// POST /api/share { token, password } : パスワード照合の上で記録を返す
//
// レスポンスはallowlist方式（password_hash・Storageの実パス・owner_idの生値は含めない）。
// 「リンクが無効」と「パスワードが違う」は区別せず、常に { error: "invalid" } を返す。

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { isAllowedOrigin, rateLimit } from "./lib/guard.js";

const BUCKET = "record-photos";
const SIGNED_URL_TTL = 3600;
const PASSWORD_RATE_LIMIT_MAX = 5;
const PASSWORD_RATE_LIMIT_WINDOW_MS = 60_000;

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// パスワード照合の試行回数をDBで管理する（サーバーレス関数はインスタンスが
// 複数に分かれうるため、guard.jsのin-memory rateLimitだけでは4桁パスワードの
// 総当たりを防ぎきれない。record_share_attemptsテーブルにtoken単位で記録する）。
async function checkPasswordRateLimit(sb, token) {
  const cutoff = new Date(Date.now() - PASSWORD_RATE_LIMIT_WINDOW_MS).toISOString();
  await sb.from("record_share_attempts").delete().lt("attempted_at", cutoff);
  const { count } = await sb.from("record_share_attempts")
    .select("id", { count: "exact", head: true })
    .eq("share_token", token).gte("attempted_at", cutoff);
  if ((count ?? 0) >= PASSWORD_RATE_LIMIT_MAX) return false;
  await sb.from("record_share_attempts").insert({ share_token: token });
  return true;
}

async function buildRecordPayload(sb, share) {
  const { data: record } = await sb.from("records")
    .select("title, year, poster_path, genres, note, image, watched_at")
    .eq("id", share.record_id).maybeSingle();
  if (!record) return null;

  const { data: owner } = await sb.from("profiles").select("public_id, display_name").eq("id", share.owner_id).maybeSingle();

  let image = null;
  if (record.image) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(record.image, SIGNED_URL_TTL);
    image = signed?.signedUrl || null;
  }

  return {
    title: record.title,
    year: record.year,
    posterPath: record.poster_path,
    genres: record.genres || [],
    note: record.note || "",
    watchedAt: record.watched_at,
    image,
    owner: owner ? { publicId: owner.public_id, name: owner.display_name } : null,
  };
}

export default async function handler(req, res) {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "forbidden_origin" });
  if (!rateLimit(req, { max: 30, windowMs: 60_000, key: "share" })) return res.status(429).json({ error: "rate_limited" });

  const sb = adminClient();
  if (!sb) return res.status(200).json({ error: "no_key" });

  const token = (req.method === "GET" ? req.query.token : req.body?.token || "").toString().trim();
  if (!token) return res.status(400).json({ error: "bad_request" });

  const { data: share } = await sb.from("record_shares")
    .select("record_id, owner_id, password_hash").eq("share_token", token).maybeSingle();
  if (!share) return res.status(404).json({ error: "invalid" });

  if (!share.password_hash) {
    const payload = await buildRecordPayload(sb, share);
    if (!payload) return res.status(404).json({ error: "invalid" });
    return res.status(200).json(payload);
  }

  if (req.method === "GET") {
    return res.status(200).json({ needsPassword: true });
  }

  const password = (req.body?.password || "").toString();
  if (!(await checkPasswordRateLimit(sb, token))) return res.status(429).json({ error: "rate_limited" });

  const match = password && (await bcrypt.compare(password, share.password_hash));
  if (!match) return res.status(403).json({ error: "invalid" });

  const payload = await buildRecordPayload(sb, share);
  if (!payload) return res.status(404).json({ error: "invalid" });
  return res.status(200).json(payload);
}
