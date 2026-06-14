// 自由入力の場所（または現在地）から、近くの映画館をさがす中継。
// OpenStreetMap の無料サービスを使う（APIキー・課金なし）：
//   - Nominatim：地名・駅名 → 緯度経度
//   - Overpass ：その周辺の amenity=cinema を取得
// 徒歩分は直線距離からの概算（経路APIは使わない）。
// ※ これらは無料の共有インフラなので、個人利用の範囲で使うこと。

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
    const ql = `[out:json][timeout:8];(node["amenity"="cinema"](around:${radius},${lat},${lon});way["amenity"="cinema"](around:${radius},${lat},${lon}););out center tags;`;
    const or = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "cinetabi/1.0 (personal hobby app)" },
      body: "data=" + encodeURIComponent(ql),
    });
    const od = await or.json();

    const seen = new Set();
    const cinemas = (od.elements || [])
      .map((e) => {
        const elat = e.lat ?? (e.center && e.center.lat);
        const elon = e.lon ?? (e.center && e.center.lon);
        if (elat == null || elon == null) return null;
        const name = (e.tags && (e.tags.name || e.tags["name:ja"] || e.tags["brand"])) || "（名称未登録の映画館）";
        const dist = haversine(lat, lon, elat, elon);
        return { id: e.type + e.id, name, dist: Math.round(dist), walk: Math.max(1, Math.round(dist / 80)) };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist)
      .filter((c) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
      .slice(0, 20);

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ label, cinemas });
  } catch (e) {
    return res.status(200).json({ error: "failed" });
  }
}
