// 「イオンシネマ」「109シネマズ」等、支店名を含まないブランド名だけのOSMタグは
// 全国の複数の実在地に存在するため、単純な部分一致だけでは別の館と誤って結び付く。
// check-osm-closed.js の閉館突合・座標検証で使う名前照合ロジックをここにまとめる。
import { haversine } from "./geo.js";

// 名前の表記ゆれ（大文字小文字・スペース・中黒）を吸収して比較する
const normalize = (s) => (s || "").toLowerCase().replace(/[\s　・･]/g, "");

export function nameMatch(a, b) {
  const na = normalize(a), nb = normalize(b);
  return na && nb && (na.includes(nb) || nb.includes(na));
}

// 名前一致した候補が複数ある場合、.find()で最初の一致を採用すると全く別の支店と
// 結び付く誤りが起きる（例: 桑名のノードが明和にマッチ）。距離が最も近いものを採用する。
export function nearestByName(osmName, lat, lon, candidates) {
  const matches = candidates.filter((c) => nameMatch(osmName, c.name));
  if (matches.length <= 1) return matches[0] || null;
  return matches.reduce((best, c) => {
    const d = c.lat != null ? haversine(lat, lon, c.lat, c.lon) : Infinity;
    const bestD = best.lat != null ? haversine(lat, lon, best.lat, best.lon) : Infinity;
    return d < bestD ? c : best;
  });
}
