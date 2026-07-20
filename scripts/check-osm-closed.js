/**
 * check-osm-closed.js
 *
 * 対象地域のOSM（Overpass）上の amenity=cinema を取得し、scrape-wiki.js の結果と突合して
 * 3つに分類するスクリプト:
 *
 *   1. ok       : 営業中リストの館と一致（名前 or 300m以内）→ そのままでよい
 *   2. closed   : wikiの閉館リストと名前が一致 → closed-cinemas.json への追記候補
 *                 （候補JSONを出力するので、目視確認して closed-cinemas.json に貼り付ける）
 *   3. unknown  : どちらとも一致しない → 手動確認対象（渋谷区の「HACK」のような
 *                 OSM誤タグ・スクレイプ漏れ・別称のいずれか）
 *
 * 使い方:
 *   node scripts/check-osm-closed.js --region 東京都渋谷区 <scrape出力.json> <geocode出力.json>
 *
 * ※ Overpassは無料の共有インフラ。地域あたり1クエリのみ、504時は1回だけリトライ。
 */

import { readFileSync } from "node:fs";
import { sleep } from "./lib/sleep.js";
import { USER_AGENT } from "./lib/user-agent.js";
import { haversine } from "./lib/geo.js";
import { nameMatch, nearestByName } from "./lib/chain-match.js";
import { searchNominatim } from "./lib/nominatim.js";

async function fetchOverpass(areaFilter) {
  const ql = `[out:json][timeout:25];${areaFilter.prefix}(node["amenity"="cinema"]${areaFilter.cond};way["amenity"="cinema"]${areaFilter.cond};);out center tags;`;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) { console.log("Overpassが混雑中。15秒待ってリトライします..."); await sleep(15000); }
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(ql),
      });
      if (r.ok) return r.json();
    } catch {}
  }
  throw new Error("Overpassから取得できませんでした（時間をおいて再実行してください）");
}

async function main() {
  const args = process.argv.slice(2);
  const regionIdx = args.indexOf("--region");
  if (regionIdx === -1 || args.length < 4) {
    console.error("使い方: node scripts/check-osm-closed.js --region 東京都渋谷区 <scrape出力.json> <geocode出力.json>");
    process.exit(1);
  }
  const region = args[regionIdx + 1];
  const [scrapePath, geocodePath] = args.filter((_, i) => i !== regionIdx && i !== regionIdx + 1);

  const scraped = JSON.parse(readFileSync(scrapePath, "utf-8"));
  const geocoded = JSON.parse(readFileSync(geocodePath, "utf-8"));

  // 地域bboxをNominatimで取得
  const regionHit = await searchNominatim(region);
  if (!regionHit) { console.error(`地域「${region}」が見つかりません`); process.exit(1); }

  // 行政区は形が複雑で、bbox（矩形）だと隣接区の映画館まで拾ってしまう。
  // Nominatimがrelationを返した場合はOSMのareaクエリで正確な区境ポリゴンを使う。
  let areaFilter;
  if (regionHit.osm_type === "relation") {
    areaFilter = { prefix: `area(${3600000000 + regionHit.osm_id})->.a;`, cond: "(area.a)" };
  } else {
    const [minLat, maxLat, minLon, maxLon] = regionHit.boundingbox.map(parseFloat);
    areaFilter = { prefix: "", cond: `(${minLat},${minLon},${maxLat},${maxLon})` };
    console.warn("※ 区境ポリゴンが取れないためbboxで検索します（隣接地域の館が混ざることがあります）");
  }
  console.log(`地域: ${region}\n`);

  const od = await fetchOverpass(areaFilter);

  const closedCandidates = [];
  const websiteOverrides = [];
  const coordMismatches = [];
  const COORD_MISMATCH_THRESHOLD_M = 2000;
  for (const e of od.elements || []) {
    const lat = e.lat ?? (e.center && e.center.lat);
    const lon = e.lon ?? (e.center && e.center.lon);
    if (lat == null || lon == null) continue;
    const osmName = (e.tags && (e.tags.name || e.tags["name:ja"] || e.tags.brand)) || "（名称なし）";
    const osmWebsite = (e.tags && (e.tags.website || e.tags["contact:website"])) || null;

    // 名前一致（営業中）・名前一致（閉館）・近接（営業中）をそれぞれ判定し、組み合わせで分類する。
    // 近接判定はAPIの重複判定と同じ基準（neighbourhood精度は300m、それ以外は100m）。
    const opByName = nearestByName(osmName, lat, lon, geocoded);
    const clByName = scraped.closed.find((c) => (c.nameVariants || [c.name]).some((v) => nameMatch(osmName, v)));
    const opByDist = geocoded.find(
      (c) => c.lat != null && haversine(lat, lon, c.lat, c.lon) < (c.precision === "neighbourhood" ? 300 : 100)
    );

    // OSMのwebsiteタグは実際の建物・座標に紐づいているため、Wikipedia infoboxの外部リンクが
    // 入居施設（モール等）を指してしまうケースより信頼できる。名前一致した営業中の館については、
    // OSM側にwebsiteタグがあれば優先候補として記録する（機械的に上書きはせず、目視確認のうえ適用する）。
    if (opByName && osmWebsite && osmWebsite !== opByName.website) {
      websiteOverrides.push({ name: opByName.name, current: opByName.website || null, osm: osmWebsite });
    }

    // OSM側は実座標なので、名前一致した館のcurated座標がここから大きく離れていたら
    // ジオコーディング誤り（浜松市の区再編ケースのような）の可能性が高い。目視確認対象として記録する。
    if (opByName && opByName.lat != null) {
      const distM = haversine(lat, lon, opByName.lat, opByName.lon);
      if (distM > COORD_MISMATCH_THRESHOLD_M) {
        coordMismatches.push({
          name: opByName.name,
          curated: { lat: opByName.lat, lon: opByName.lon },
          osm: { lat, lon },
          distanceM: Math.round(distM),
        });
      }
    }

    if (clByName && (opByName || opByDist)) {
      // 例: OSMの「東宝シネマ」はTOHOシネマズ渋谷と同一座標だが、同じ跡地の前身館
      // 「渋谷宝塚・東宝シネマ」（閉館）とも名前が一致する。自動では決められない。
      const op = opByName || opByDist;
      console.log(`[要確認]  ${osmName} … 閉館「${clByName.name}」とも営業中「${op.name}」とも一致。旧名タグの現役館か閉館館か目視確認`);
    } else if (opByName) {
      console.log(`[ok]      ${osmName} ≒ ${opByName.name}（名前一致）`);
    } else if (clByName) {
      console.log(`[closed]  ${osmName} → 「${clByName.name}」(閉館: ${clByName.closed})`);
      closedCandidates.push({
        name: clByName.name,
        matchNames: [...new Set([osmName.toLowerCase(), ...(clByName.nameVariants || [clByName.name]).map((v) => v.toLowerCase())])],
        lat, lon,
        closed: clByName.closed,
        note: "OSM上は amenity=cinema のまま残っているが「消えた映画館の記憶」によれば閉館済み",
      });
    } else if (opByDist) {
      // 名前は一致せず近接のみ。英字表記の同一館（Cinema Vera等）のことも、
      // 近くの閉館館（Uplink等）のこともあるので、必ず目視確認する。
      console.log(`[ok?]     ${osmName} ≒ ${opByDist.name}（近接のみ・名前不一致 ← 別の閉館館の可能性もあるため目視確認）`);
    } else {
      console.log(`[unknown] ${osmName} (${lat}, ${lon}) osm:${e.type}/${e.id} ← 手動確認が必要`);
    }
  }

  if (closedCandidates.length > 0) {
    console.log(`\n--- closed-cinemas.json への追記候補（目視確認のうえ貼り付け） ---`);
    console.log(JSON.stringify(closedCandidates, null, 2));
  }

  if (websiteOverrides.length > 0) {
    console.log(`\n--- websiteをOSM側の値に差し替える候補（目視確認のうえ適用） ---`);
    console.log(JSON.stringify(websiteOverrides, null, 2));
  }

  if (coordMismatches.length > 0) {
    console.log(`\n--- 座標がOSM実座標と${COORD_MISMATCH_THRESHOLD_M}m以上離れている館（ジオコーディング誤りの疑い、目視確認） ---`);
    console.log(JSON.stringify(coordMismatches, null, 2));
  }
}

main();
