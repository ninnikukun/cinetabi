// 自由入力の場所（または現在地）から、近くの映画館をさがす中継。
//   - Nominatim（無料）：地名・駅名 → 緯度経度
//   - Overpass（無料）：その周辺の amenity=cinema を取得
//   - curated-cinemas.json：「消えた映画館の記憶」(https://hekikaicinema.memo.wiki/, CC) から
//     手作業で精度確認したデータ。Overpassより優先し、近い地点のOverpass結果は重複除去する。
//   - closed-cinemas.json：同じ資料から確認できた「閉館済みだがOSM側のタグが未更新」の映画館。
//     名前と座標でOverpass結果から除外する。
//   - 徒歩分：OpenRouteService の Matrix API（無料枠）で実際の道のりから計算。
//     ORS_API_KEY が未設定の場合は直線距離÷80分の概算にフォールバックする。
// ※ これらは無料の共有インフラなので、個人利用の範囲で使うこと。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const curatedCinemas = JSON.parse(readFileSync(path.join(__dirname, "data", "curated-cinemas.json"), "utf-8"));
const closedCinemas = JSON.parse(readFileSync(path.join(__dirname, "data", "closed-cinemas.json"), "utf-8"));

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 1回のMatrixリクエストで、出発地→各候補地の徒歩所要時間（秒）をまとめて取得。
// 失敗時・キー未設定時は null を返し、呼び出し側は直線距離での概算にフォールバックする。
async function fetchWalkDurations(lat, lon, points) {
  const key = process.env.ORS_API_KEY;
  if (!key || points.length === 0) return null;
  try {
    const body = {
      locations: [[lon, lat], ...points.map((p) => [p.lon, p.lat])],
      sources: [0],
      destinations: points.map((_, i) => i + 1),
      metrics: ["duration"],
    };
    const r = await fetch("https://api.openrouteservice.org/v2/matrix/foot-walking", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": "cinetabi/1.0 (personal hobby app)" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.durations && d.durations[0]) || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const q = (req.query.q || "").toString().trim();
  const latQ = req.query.lat, lonQ = req.query.lon;

  let lat, lon, label;
  try {
    if (latQ && lonQ) {
      lat = parseFloat(latQ); lon = parseFloat(lonQ); label = "現在地";
    } else if (q) {
      const gurl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&countrycodes=jp&q=${encodeURIComponent(q)}`;
      const gr = await fetch(gurl, { headers: { "User-Agent": "cinetabi/1.0 (personal hobby app)", "Accept-Language": "ja" } });
      const gd = await gr.json();
      if (!Array.isArray(gd) || gd.length === 0) return res.status(200).json({ error: "not_found" });
      lat = parseFloat(gd[0].lat); lon = parseFloat(gd[0].lon);
      label = (gd[0].display_name || q).split(",")[0];
    } else {
      return res.status(400).json({ error: "no_query" });
    }

    const radius = 3000; // 3km以内を取得し、フロントで徒歩分でしぼる

    // キュレーションデータのうち検索範囲内のものを先に確定させる（Overpassより優先）。
    const curatedNearby = curatedCinemas
      .map((c) => ({ ...c, dist: haversine(lat, lon, c.lat, c.lon) }))
      .filter((c) => c.dist <= radius);

    // Overpassの無料インスタンスは一時的に混雑・タイムアウトすることがある。
    // その場合もキュレーションデータだけは返せるよう、ここだけ個別にフォールバックする。
    let od = { elements: [] };
    try {
      const ql = `[out:json][timeout:8];(node["amenity"="cinema"](around:${radius},${lat},${lon});way["amenity"="cinema"](around:${radius},${lat},${lon}););out center tags;`;
      const or = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "cinetabi/1.0 (personal hobby app)" },
        body: "data=" + encodeURIComponent(ql),
      });
      if (or.ok) od = await or.json();
    } catch {
      // Overpass失敗時はキュレーションデータのみで続行
    }

    // キュレーション地点の近くにあるOverpass結果は同一の映画館とみなし、キュレーション側を採用する。
    // 「neighbourhood」精度（町丁目の重心など）は建物までのズレが数百mありうるため、判定距離を広げる。
    const isDuplicateOfCurated = (elat, elon) =>
      curatedNearby.some((c) => haversine(c.lat, c.lon, elat, elon) < (c.precision === "neighbourhood" ? 300 : 100));

    // 「消えた映画館の記憶」で閉館確認済みだが、OSM側のタグがまだ更新されていない映画館を除外する。
    const isKnownClosed = (name, elat, elon) =>
      closedCinemas.some(
        (c) => haversine(c.lat, c.lon, elat, elon) < 150 && c.matchNames.includes((name || "").toLowerCase())
      );

    const overpassCinemas = (od.elements || [])
      .map((e) => {
        const elat = e.lat ?? (e.center && e.center.lat);
        const elon = e.lon ?? (e.center && e.center.lon);
        if (elat == null || elon == null) return null;
        if (isDuplicateOfCurated(elat, elon)) return null;
        let name = (e.tags && (e.tags.name || e.tags["name:ja"] || e.tags["brand"])) || "（名称未登録の映画館）";
        if (isKnownClosed(name, elat, elon)) return null;
        // 同一チェーンの別店舗（例：TOHOシネマズ）と紛らわしいので、支店名タグがあれば付け足す。
        const branch = e.tags && e.tags.branch;
        if (branch && !name.includes(branch)) name = `${name}（${branch}）`;
        const website = (e.tags && (e.tags.website || e.tags["contact:website"])) || null;
        return { id: e.type + e.id, name, lat: elat, lon: elon, dist: haversine(lat, lon, elat, elon), precision: "poi", website };
      })
      .filter(Boolean);

    const curatedFormatted = curatedNearby.map((c, i) => ({
      id: "curated" + i,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      dist: c.dist,
      precision: c.precision,
      website: c.website || null,
    }));

    const seen = new Set();
    const merged = [...curatedFormatted, ...overpassCinemas]
      .sort((a, b) => a.dist - b.dist)
      .filter((c) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
      .slice(0, 20);

    const durations = await fetchWalkDurations(lat, lon, merged.map((c) => ({ lat: c.lat, lon: c.lon })));

    const cinemas = merged.map((c, i) => {
      const secs = durations && durations[i] != null ? durations[i] : null;
      const walk = secs != null ? Math.max(1, Math.round(secs / 60)) : Math.max(1, Math.round(c.dist / 80));
      return {
        id: c.id,
        name: c.name,
        dist: Math.round(c.dist),
        walk,
        isApprox: c.precision === "neighbourhood",
        website: c.website || null,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ label, cinemas });
  } catch (e) {
    return res.status(200).json({ error: "failed" });
  }
}
