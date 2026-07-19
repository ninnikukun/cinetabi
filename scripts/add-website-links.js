/**
 * add-website-links.js
 *
 * 既存の映画館JSON（geocode.js出力など）に、Wikipediaのinfoboxから
 * 「公式サイト」のURLを抽出して website フィールドを補完するスクリプト。
 * geocode.js が wiki本文の「公式サイト」行から既に website を埋めていることがあるため、
 * 既に値がある（null/未設定でない）ものはWikipediaへ問い合わせずスキップする。
 *
 * 前提:
 * - 入力JSONは配列で、各要素に映画館名 (name) と、
 *   対応するWikipediaページタイトル (wikipediaTitle) を持っている想定。
 *   wikipediaTitle が無い場合は name をそのままページタイトルとして使う。
 * - Node.js 18以降（組み込みfetchを使用）
 *
 * 使い方:
 *   npm install --no-save cheerio
 *   node scripts/add-website-links.js input.json output.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";

// Wikipediaのinfoboxで「公式サイト」を表すラベルの表記ゆれ
const WEBSITE_LABEL_PATTERNS = [
  "公式サイト",
  "公式ウェブサイト",
  "ウェブサイト",
  "Webサイト",
  "ホームページ",
  "外部リンク",
  "URL",
  "website",
];

// リクエスト間隔（Wikipediaへの負荷軽減のため）
const REQUEST_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定したWikipediaページタイトルから、infobox内の公式サイトURLを取得する。
 * 見つからない場合は null を返す。
 */
async function fetchOfficialWebsite(pageTitle) {
  const url = `https://ja.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "cinetabi-data-collector/1.0 (personal project)",
      },
    });
    if (!res.ok) {
      console.warn(`  [skip] ${pageTitle}: HTTP ${res.status}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.warn(`  [error] ${pageTitle}: ${err.message}`);
    return null;
  }

  const $ = cheerio.load(html);

  let websiteUrl = null;

  $(".infobox tr").each((_, row) => {
    if (websiteUrl) return;

    const label = $(row).find("th").first().text().trim();
    const isWebsiteRow = WEBSITE_LABEL_PATTERNS.some((pattern) => label.includes(pattern));
    if (!isWebsiteRow) return;

    const link = $(row).find('td a[href^="http"]').first().attr("href");
    if (link) websiteUrl = link;
  });

  return websiteUrl;
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("使い方: node scripts/add-website-links.js input.json output.json");
    process.exit(1);
  }

  const raw = readFileSync(inputPath, "utf-8");
  const cinemas = JSON.parse(raw);

  console.log(`${cinemas.length}件の映画館データを処理します...`);

  const enriched = [];
  let skipped = 0;
  for (const cinema of cinemas) {
    if (cinema.website) {
      // wiki本文の「公式サイト」行等で既に取得済み
      enriched.push(cinema);
      skipped++;
      continue;
    }

    const pageTitle = cinema.wikipediaTitle || cinema.name;
    console.log(`- ${cinema.name} (${pageTitle}) を検索中...`);

    const website = await fetchOfficialWebsite(pageTitle);

    if (website) {
      console.log(`  → 見つかりました: ${website}`);
    } else {
      console.log("  → 公式サイトが見つかりませんでした（手動確認が必要です）");
    }

    enriched.push({ ...cinema, website: website || null });

    await sleep(REQUEST_DELAY_MS);
  }
  if (skipped > 0) console.log(`(${skipped}件は既にwebsiteがあったためWikipediaへは問い合わせていません)`);

  writeFileSync(outputPath, JSON.stringify(enriched, null, 2), "utf-8");

  const foundCount = enriched.filter((c) => c.website).length;
  console.log(`\n完了: ${foundCount}/${cinemas.length}件で公式サイトを取得しました。`);
  console.log(`出力先: ${outputPath}`);

  const missing = enriched.filter((c) => !c.website).map((c) => c.name);
  if (missing.length > 0) {
    console.log("\n手動確認が必要な映画館:");
    missing.forEach((name) => console.log(`  - ${name}`));
  }
}

main();
