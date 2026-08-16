// 通報管理画面（隠しルート ?admin=reports）用の中継。
// 呼び出し元のSupabaseセッションを検証し、user_idがADMIN_USER_IDS
// （カンマ区切り環境変数）に含まれる場合のみ、service_role鍵で
// record_reports（RLS上クライアントに一切公開していない）の中身を返す。
//
// GET  /api/admin-reports  ：通報一覧 + 対象記録 + 通報者/投稿者情報を返す
// POST /api/admin-reports { reportId } ：resolved=true に更新
//
// Authorization: Bearer <access_token> ヘッダーが必須。

import { createClient } from "@supabase/supabase-js";
import { isAllowedOrigin, rateLimit } from "./lib/guard.js";

const BUCKET = "record-photos";
const SIGNED_URL_TTL = 3600;

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ADMIN_USER_IDS未設定・トークン不正・リスト不一致はすべて同じ403
// （fail-closed。「鍵が無いから素通し」を絶対にしない）。
// ponytail: 403の原因切り分け用の一時ログ。原因判明後は削除すること。
async function requireAdmin(sb, req) {
  const authHeader = req.headers?.authorization || "";
  console.log("[admin-reports] authHeader present:", !!authHeader, "startsWithBearer:", authHeader.startsWith("Bearer "));
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { console.log("[admin-reports] no token -> reject"); return null; }
  const { data, error } = await sb.auth.getUser(token);
  console.log("[admin-reports] getUser error:", error?.message || null, "userId:", data?.user?.id || null);
  if (error || !data?.user) { console.log("[admin-reports] getUser failed -> reject"); return null; }
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  console.log("[admin-reports] adminIds count:", adminIds.length, "userId in list:", adminIds.includes(data.user.id));
  if (adminIds.length === 0 || !adminIds.includes(data.user.id)) { console.log("[admin-reports] not in admin list -> reject"); return null; }
  return data.user;
}

async function listReports(sb) {
  const { data: reports, error } = await sb.from("record_reports")
    .select("id, record_id, reporter_id, reason, resolved, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!reports || reports.length === 0) return [];

  const recordIds = [...new Set(reports.map(r => r.record_id))];
  const { data: records } = await sb.from("records")
    .select("id, user_id, title, note, image, watched_at").in("id", recordIds);
  const recordById = {};
  (records || []).forEach(r => { recordById[r.id] = r; });

  const userIds = new Set(reports.map(r => r.reporter_id));
  (records || []).forEach(r => userIds.add(r.user_id));
  const { data: profiles } = await sb.from("profiles").select("id, display_name, public_id").in("id", [...userIds]);
  const profileById = {};
  (profiles || []).forEach(p => { profileById[p.id] = p; });

  const imagePaths = (records || []).map(r => r.image).filter(Boolean);
  const urlByPath = {};
  if (imagePaths.length) {
    const { data: signedList } = await sb.storage.from(BUCKET).createSignedUrls(imagePaths, SIGNED_URL_TTL);
    (signedList || []).forEach(s => { if (s?.signedUrl && !s.error) urlByPath[s.path] = s.signedUrl; });
  }

  const toProfile = (id) => {
    const p = profileById[id];
    return p ? { name: p.display_name, publicId: p.public_id } : null;
  };

  return reports.map(r => {
    const record = recordById[r.record_id];
    return {
      id: r.id,
      reason: r.reason,
      resolved: r.resolved,
      createdAt: r.created_at,
      reporter: toProfile(r.reporter_id),
      // recordがnullなのは、投稿者が記録自体を削除した後（cascadeで通常は
      // record_reportsごと消えるが、削除タイミングとの競合を考慮し防御的に扱う）
      record: record ? {
        title: record.title,
        note: record.note,
        watchedAt: record.watched_at,
        image: record.image ? (urlByPath[record.image] || null) : null,
        owner: toProfile(record.user_id),
      } : null,
    };
  });
}

export default async function handler(req, res) {
  // ponytail: 403の原因切り分け用の一時ログ。原因判明後は削除すること。
  console.log("[admin-reports] method:", req.method, "origin:", req.headers?.origin, "host:", req.headers?.host);
  if (!isAllowedOrigin(req)) { console.log("[admin-reports] rejected by isAllowedOrigin"); return res.status(403).json({ error: "forbidden_origin" }); }
  if (!rateLimit(req, { max: 30, windowMs: 60_000, key: "admin-reports" })) return res.status(429).json({ error: "rate_limited" });

  const sb = adminClient();
  if (!sb) return res.status(200).json({ error: "no_key" });

  const admin = await requireAdmin(sb, req);
  if (!admin) return res.status(403).json({ error: "forbidden" });

  if (req.method === "POST") {
    const reportId = (req.body?.reportId || "").toString();
    if (!reportId) return res.status(400).json({ error: "bad_request" });
    const { error } = await sb.from("record_reports").update({ resolved: true }).eq("id", reportId);
    if (error) return res.status(500).json({ error: "update_failed" });
    return res.status(200).json({ ok: true });
  }

  try {
    const reports = await listReports(sb);
    return res.status(200).json({ reports });
  } catch {
    return res.status(500).json({ error: "fetch_failed" });
  }
}
