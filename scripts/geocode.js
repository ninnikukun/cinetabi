/**
 * geocode.js
 *
 * scrape-wiki.js の出力（営業中リスト）に Nominatim で緯度経度を付与するスクリプト。
 *
 * 渋谷区パイロットで確立した戦略:
 *   1. POI名で検索（例:「シネマヴェーラ渋谷」）→ 建物単位で正確 → precision "poi"
 *   2. 番地レベルの住所で検索（日本の住所は失敗しがちだが、当たれば正確）→ "poi"
 *   3. 丁目レベルに落とした住所で検索（例:「東京都渋谷区渋谷2丁目」）→ "neighbourhood"
 *   4. 全部外れたら precision "failed"（手動確認対象として警告）
 *
 * 結果は必ず対象地域のバウンディングボックス内かチェックする（同名POIの誤ヒット対策）。
 * bboxは --region で指定した地域名（例: 東京都渋谷区）をNominatimで引いて得る。
 *
 * 使い方:
 *   node scripts/geocode.js --region 東京都渋谷区 <scrape出力.json> <出力.json>
 *
 * ※ Nominatimの利用ポリシー（1リクエスト/秒）を守るため、リクエスト間は1.1秒待機。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { searchNominatim } from "./lib/nominatim.js";

const REQUEST_DELAY_MS = 1100;
const nominatim = (query) => searchNominatim(query, { delayMs: REQUEST_DELAY_MS });

// 「東京都渋谷区渋谷2-10-2 イメージフォーラムビル」→「東京都渋谷区渋谷2丁目」
function toChomeQuery(address) {
  const noBuilding = address.split(/[\s　]/)[0]; // 建物名（スペース以降）を除去
  const m = noBuilding.match(/^(.+?[^0-9０-９])([0-9０-９]+)[-−ー]/);
  if (m) return `${m[1]}${m[2]}丁目`;
  return noBuilding; // 数字がない住所はそのまま
}

// 「東京都渋谷区円山町1-5 KINOHAUS」→「東京都渋谷区円山町」
// 丁目を持たない町（円山町・宇田川町など）は番地を全部落として町名センチロイドで引く。
function toMachiQuery(address) {
  const noBuilding = address.split(/[\s　]/)[0];
  return noBuilding.replace(/[0-9０-９][0-9０-９\-−ー]*$/, "").trim();
}

function inBbox(lat, lon, bbox) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

async function main() {
  const args = process.argv.slice(2);
  const regionIdx = args.indexOf("--region");
  if (regionIdx === -1 || args.length < 4) {
    console.error("使い方: node scripts/geocode.js --region 東京都渋谷区 <scrape出力.json> <出力.json>");
    process.exit(1);
  }
  const region = args[regionIdx + 1];
  const [inputPath, outputPath] = args.filter((_, i) => i !== regionIdx && i !== regionIdx + 1);

  // 対象地域のバウンディングボックスを取得（誤ヒット検出用。少し余裕を持たせる）
  const regionHit = await nominatim(region);
  if (!regionHit || !regionHit.boundingbox) {
    console.error(`地域「${region}」のバウンディングボックスが取得できませんでした`);
    process.exit(1);
  }
  const [minLat, maxLat, minLon, maxLon] = regionHit.boundingbox.map(parseFloat);
  const pad = 0.02; // 約2km。区境ぎわの館や広めのbbox誤差を許容
  const bbox = { minLat: minLat - pad, maxLat: maxLat + pad, minLon: minLon - pad, maxLon: maxLon + pad };
  console.log(`地域: ${region} bbox=[${minLat},${minLon}]-[${maxLat},${maxLon}]`);

  const input = JSON.parse(readFileSync(inputPath, "utf-8"));
  const cinemas = input.operating || input; // scrape出力 or 素の配列どちらも受ける

  const out = [];
  for (const c of cinemas) {
    console.log(`- ${c.name}`);
    let lat = null, lon = null, precision = "failed";

    // 1. POI名検索
    const poi = await nominatim(c.name);
    if (poi && inBbox(parseFloat(poi.lat), parseFloat(poi.lon), bbox)) {
      lat = parseFloat(poi.lat); lon = parseFloat(poi.lon); precision = "poi";
      console.log(`  → POI名でヒット (${lat}, ${lon})`);
    }

    // 2. 番地レベルの住所検索
    if (precision === "failed" && c.address) {
      const addr = await nominatim(c.address.split(/[\s　]/)[0]);
      if (addr && inBbox(parseFloat(addr.lat), parseFloat(addr.lon), bbox)) {
        lat = parseFloat(addr.lat); lon = parseFloat(addr.lon); precision = "poi";
        console.log(`  → 番地住所でヒット (${lat}, ${lon})`);
      }
    }

    // 3. 丁目レベルにフォールバック
    if (precision === "failed" && c.address) {
      const chomeQuery = toChomeQuery(c.address);
      const chome = await nominatim(chomeQuery);
      if (chome && inBbox(parseFloat(chome.lat), parseFloat(chome.lon), bbox)) {
        lat = parseFloat(chome.lat); lon = parseFloat(chome.lon); precision = "neighbourhood";
        console.log(`  → 丁目レベル「${chomeQuery}」でヒット (${lat}, ${lon})`);
      }
    }

    // 4. 丁目を持たない町（円山町など）は町名センチロイドにフォールバック
    if (precision === "failed" && c.address) {
      const machiQuery = toMachiQuery(c.address);
      const machi = await nominatim(machiQuery);
      if (machi && inBbox(parseFloat(machi.lat), parseFloat(machi.lon), bbox)) {
        lat = parseFloat(machi.lat); lon = parseFloat(machi.lon); precision = "neighbourhood";
        console.log(`  → 町名レベル「${machiQuery}」でヒット (${lat}, ${lon})`);
      }
    }

    if (precision === "failed") console.warn(`  [要手動確認] ${c.name}: ジオコーディング失敗`);

    out.push({
      name: c.name,
      address: c.address,
      lat, lon, precision,
      website: c.officialSite || null,
      wikipediaTitle: c.wikipediaTitle || null,
      sourcePage: c.sourcePage || null,
    });
  }

  writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf-8");

  const counts = out.reduce((a, c) => ((a[c.precision] = (a[c.precision] || 0) + 1), a), {});
  console.log(`\n完了: ${out.length}件 (precision内訳: ${JSON.stringify(counts)})`);
  console.log(`出力先: ${outputPath}`);
}

main();
