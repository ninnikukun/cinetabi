/**
 * scrape-wiki.js
 *
 * 「消えた映画館の記憶」(https://hekikaicinema.memo.wiki/, CCライセンス・サイト名表示条件)
 * の市・区単位ページから、営業中・閉館済みの映画館を抽出するスクリプト。
 *
 * ページ構造（2026年7月時点）:
 *   各映画館 = <div class="wiki-section-3"> ブロック
 *   <h5>旧名称/現名称</h5> のあと、本文に定型行が並ぶ:
 *     所在地 : 住所（掲載年）、住所（掲載年）...   ← 最後の住所が最新
 *     閉館年 : 営業中 | 閉館日
 *     公式サイト : <a href="...">              ← ある館のみ
 *     Wikipedia : <a href="...wiki/タイトル">   ← ある館のみ
 *
 * 使い方:
 *   node scripts/scrape-wiki.js <ページ名...> <出力.json>
 *   例: node scripts/scrape-wiki.js 渋谷区の映画館 out.json
 *       node scripts/scrape-wiki.js 新宿区の映画館 中野区の映画館 out.json
 *
 * 出力: { operating: [{name, address, statusRaw, officialSite, wikipediaTitle, sourcePage}],
 *         closed:    [{name, nameVariants, address, closed, sourcePage}] }
 *
 * ※ 無料の共有インフラなので、ページ間は2秒待機し、UAに連絡先を明記する。
 */

import { writeFileSync } from "node:fs";

const USER_AGENT = "cinetabi-data-collector/1.0 (personal project; contact: ek17.fcsj@gmail.com)";
const PAGE_DELAY_MS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchEucJp(url) {
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const buf = await r.arrayBuffer();
  return new TextDecoder("euc-jp").decode(buf);
}

// wikiのページURLはページ名をEUC-JPでパーセントエンコードしたもので、
// UTF-8エンコードのURLは404になる。Node標準ではEUC-JPへのエンコードができないため、
// トップページのリンク一覧から「リンクテキスト → URL」を解決する。
let pageUrlMap = null;
async function resolvePageUrl(pageName) {
  if (!pageUrlMap) {
    const top = await fetchEucJp("https://hekikaicinema.memo.wiki/");
    pageUrlMap = new Map();
    for (const m of top.matchAll(/href="(https:\/\/hekikaicinema\.memo\.wiki\/d\/[^"]+)"[^>]*>([^<]+)</g)) {
      pageUrlMap.set(m[2].trim(), m[1]);
    }
  }
  const url = pageUrlMap.get(pageName);
  if (!url) throw new Error(`ページ「${pageName}」がトップページのリンクに見つかりません`);
  return url;
}

// EUC-JPページを取得してUTF-8文字列に変換する
async function fetchPage(pageName) {
  const url = await resolvePageUrl(pageName);
  await sleep(PAGE_DELAY_MS); // トップページ取得の直後にも間隔を空ける
  return fetchEucJp(url);
}

const stripTags = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// 名称1つ分（「シネクイント1・2(新)」等）から装飾を除いて正規化
// 末尾番号は「1・2」「1-6」のような複数スクリーン表記のみ除去する。
// 単独の数字は名前の一部のことがある（例: 新宿バルト9）ので残す。
function normalizeSegment(seg) {
  return seg
    .trim()
    .replace(/[（(][^（()）]*[）)]\s*$/, "") // 末尾の（新）（円山町）等
    .replace(/[0-9０-９]+([・･][0-9０-９]+)+\s*$/, "") // 1・2・3 形式
    .replace(/[0-9０-９]+[\-−ー][0-9０-９]+\s*$/, "") // 1-6 形式
    .trim();
}

// h5タイトル「旧名/旧名/現名1・2(新)」→ 現在（最後）の名称
function normalizeName(title) {
  return normalizeSegment(title.split("/").pop());
}

// 「所在地 : A（1995年）、B（2020年・2025年）」→ 最新（最後）の住所
function latestAddress(line) {
  const body = line.replace(/^所在地\s*[:：]\s*/, "");
  const matches = [...body.matchAll(/([^（）、]+)（[^（）]*）/g)];
  if (matches.length > 0) return matches[matches.length - 1][1].trim();
  return body.trim(); // 年表記なしのケース
}

function parsePage(html, pageName) {
  const operating = [];
  const closed = [];

  // 各映画館ブロックに分割
  const blocks = html.split(/<div id="content_block_\d+" class="wiki-section-3">/).slice(1);

  for (const block of blocks) {
    const h5m = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/);
    if (!h5m) continue;
    // 部分編集リンク等を除去してタイトルを取り出す
    const title = stripTags(h5m[1].replace(/<a[\s\S]*?<\/a>/g, ""));
    if (!title) continue;

    // 本文をタグ保持のまま行に分解（公式サイト/WikipediaのURLを取るため）
    const bodyMatch = block.match(/class="wiki-section-body-3">([\s\S]*?)<\/div>/);
    const bodyHtml = bodyMatch ? bodyMatch[1] : block;
    const lines = bodyHtml.split(/<br\s*\/?>/);

    let address = null, statusRaw = null, officialSite = null, wikipediaTitle = null;
    for (const lineHtml of lines) {
      const text = stripTags(lineHtml);
      if (/^所在地\s*[:：]/.test(text)) address = latestAddress(text);
      else if (/^閉館年\s*[:：]/.test(text)) statusRaw = text.replace(/^閉館年\s*[:：]\s*/, "");
      else if (/^公式サイト\s*[:：]/.test(text)) {
        const m = lineHtml.match(/href="([^"]+)"/);
        if (m) officialSite = m[1];
      } else if (/^Wikipedia\s*[:：]/.test(text)) {
        const m = lineHtml.match(/href="https?:\/\/ja\.wikipedia\.org\/wiki\/([^"]+)"/);
        if (m) wikipediaTitle = decodeURIComponent(m[1]);
      }
    }

    if (!statusRaw) continue; // 定型行がないブロック（案内文など）はスキップ

    const name = normalizeName(title);
    const nameVariants = [...new Set(title.split("/").map(normalizeSegment).filter(Boolean))];

    if (statusRaw.includes("営業中")) {
      operating.push({ name, address, statusRaw, officialSite, wikipediaTitle, sourcePage: pageName });
    } else {
      closed.push({ name, nameVariants, address, closed: statusRaw, sourcePage: pageName });
    }
  }
  return { operating, closed };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("使い方: node scripts/scrape-wiki.js <ページ名...> <出力.json>");
    process.exit(1);
  }
  const outputPath = args.pop();
  const pages = args;

  const result = { operating: [], closed: [] };
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) await sleep(PAGE_DELAY_MS);
    console.log(`「${pages[i]}」を取得中...`);
    const html = await fetchPage(pages[i]);
    const { operating, closed } = parsePage(html, pages[i]);
    console.log(`  営業中 ${operating.length}件 / 閉館 ${closed.length}件`);
    result.operating.push(...operating);
    result.closed.push(...closed);
  }

  writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n合計: 営業中 ${result.operating.length}件 / 閉館 ${result.closed.length}件`);
  console.log(`出力先: ${outputPath}`);

  for (const c of result.operating) {
    if (!c.address) console.warn(`  [要確認] ${c.name}: 所在地が取れていません`);
  }
}

main();
