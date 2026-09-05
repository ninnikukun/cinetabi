// Drives the yomuyo dev server (http://127.0.0.1:5173) against the local mock functions
// (http://127.0.0.1:8787), captures screenshots, and runs axe-core on each screen.
const path = require('path')
const fs = require('fs')
const { chromium } = require('/opt/node22/lib/node_modules/playwright')

const APP = 'http://127.0.0.1:5173'
const FN = 'http://127.0.0.1:8787'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules/axe-core/axe.min.js'), 'utf8')

const MOBILE = { width: 390, height: 844 }
const a11y = {}
const log = (...a) => console.log('[shoot]', ...a)

async function shot(page, name, { full = true } = {}) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full })
  log('saved', name)
}

async function axe(page, name) {
  await page.addScriptTag({ content: AXE })
  const result = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160) })),
      count: v.nodes.length,
    }))
  })
  a11y[name] = result
  log(`axe ${name}: ${result.length} rule violations`)
}

async function call(name, token, body) {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Yomuyo-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${name} -> ${res.status}`)
  return res.json()
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

async function seedBooks(token) {
  const seeds = [
    { isbn: '9784101025018', title: '羅生門・鼻', author: '芥川龍之介', authorReading: 'アクタガワ リュウノスケ', publisher: '新潮社', coverImageUrl: `${FN}/covers/0.svg`, price: 440, status: 'read', tags: ['文学', '再読したい'], memo: '「羅生門」は高校の教科書以来。旅行のお供に持っていきたい薄さ。', __createdAt: daysAgo(1) },
    { isbn: '9784101010137', title: 'こころ', author: '夏目漱石', authorReading: 'ナツメ ソウセキ', publisher: '新潮社', coverImageUrl: `${FN}/covers/1.svg`, price: 407, status: 'read', tags: ['文学'], memo: '先生とKの関係を読み返したい。', __createdAt: daysAgo(2) },
    { isbn: '9784001156768', title: '星の王子さま', author: 'サン＝テグジュペリ', authorReading: null, publisher: '岩波書店', coverImageUrl: `${FN}/covers/2.svg`, price: 770, status: 'wishlist', tags: ['子どもと読む'], memo: null, __createdAt: daysAgo(3) },
    { isbn: '9784048930592', title: 'Clean Code アジャイルソフトウェア達人の技', author: 'Robert C. Martin', authorReading: null, publisher: 'KADOKAWA', coverImageUrl: `${FN}/covers/3.svg`, price: 4180, status: 'purchased', tags: ['技術書', '仕事'], memo: '仕事で参照する。第3章まで読んだ。', __createdAt: daysAgo(5) },
    { isbn: '9784794218780', title: '銃・病原菌・鉄（上） 1万3000年にわたる人類史の謎', author: 'ジャレド・ダイアモンド', authorReading: null, publisher: '草思社', coverImageUrl: null, price: 1100, status: 'wishlist', tags: [], memo: null, __createdAt: daysAgo(8) },
    { isbn: '9784152098702', title: '三体', author: '劉慈欣', authorReading: null, publisher: '早川書房', coverImageUrl: `${FN}/covers/5.svg`, price: 2090, status: 'purchased', tags: ['SF'], memo: '旅行に持っていきたい本ではない（重い）。', __createdAt: daysAgo(12) },
    { isbn: '9784043898015', title: '図書館戦争', author: '有川浩', authorReading: 'アリカワ ヒロ', publisher: 'KADOKAWA', coverImageUrl: `${FN}/covers/6.svg`, price: 660, status: 'read', tags: ['SF', '再読したい'], memo: null, __createdAt: daysAgo(20) },
    { isbn: 'gbooks:XyZ123abc', title: 'ISBNのない同人誌サンプル', author: '同人サークル', authorReading: null, publisher: null, coverImageUrl: `${FN}/covers/7.svg`, price: null, status: 'wishlist', tags: [], memo: null, __createdAt: daysAgo(30) },
  ]
  const ids = {}
  for (const s of seeds) {
    const { memo, ...body } = s
    const saved = await call('save-book', token, body)
    ids[s.title] = saved.id
    if (memo) await call('update-book', token, { id: saved.id, memo })
  }
  return ids
}

async function main() {
  const browser = await chromium.launch()
  const camBrowser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })

  // ---------- 1. Onboarding -> token issue ----------
  let ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP' })
  let page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  await page.goto(APP + '/')
  await page.getByRole('button', { name: 'はじめる' }).waitFor()
  await shot(page, '01-onboarding')
  await axe(page, '01-onboarding')
  await page.getByRole('button', { name: 'はじめる' }).click()
  await page.getByRole('button', { name: '本棚へ進む' }).waitFor()
  await shot(page, '02-onboarding-token-issued')
  await axe(page, '02-onboarding-token-issued')
  const token = await page.evaluate(() => localStorage.getItem('yomuyo_token'))
  const secretUrl = await page.locator('p', { hasText: '/b/' }).first().innerText()
  const codeText = (await page.locator('p[style*="monospace"]').first().innerText()).trim()
  log('token', token, 'code', codeText, 'url', secretUrl)
  fs.writeFileSync(path.join(OUT, 'credentials.json'), JSON.stringify({ token, recoveryCode: codeText, secretUrl }, null, 2))

  // seed library through the same API the app uses
  const ids = await seedBooks(token)
  log('seeded', Object.keys(ids).length, 'books')

  // ---------- 2. Scan page: search tab (default landing) ----------
  await page.getByRole('button', { name: '本棚へ進む' }).click()
  await page.waitForTimeout(1200)
  const stuckOnOnboarding = await page.getByRole('button', { name: '本棚へ進む' }).isVisible()
  log('BUG CHECK: still on onboarding after 本棚へ進む ->', stuckOnOnboarding)
  await shot(page, '02b-after-continue-click-still-onboarding', { full: false })
  await page.reload()
  await page.getByRole('button', { name: 'スキャン', exact: true }).waitFor()
  await shot(page, '03-scan-search-tab-empty')
  await axe(page, '03-scan-search-tab-empty')
  await page.getByPlaceholder('タイトルで探す').fill('羅生門')
  await page.locator('form').getByRole('button', { name: '検索' }).click()
  await page.locator('li button').first().waitFor()
  await shot(page, '04-scan-search-results')
  await axe(page, '04-scan-search-results')

  // pick a candidate -> lookup (openBD unreachable here -> mock lookup 404 -> not-found state)
  await page.locator('li button').first().click()
  await page.waitForTimeout(1500)
  await shot(page, '05-scan-lookup-result-state')
  await page.getByRole('button', { name: '戻る' }).click()

  // ISBN-less candidate goes straight to the confirm card (no external lookup needed)
  await page.locator('li button').nth(2).click()
  await page.getByRole('button', { name: '保存' }).waitFor()
  await shot(page, '06-scan-confirm-card')
  await axe(page, '06-scan-confirm-card')
  await page.getByRole('button', { name: '保存' }).click()
  await page.getByText('保存しました').waitFor()
  await shot(page, '07-scan-saved-post-actions')
  await axe(page, '07-scan-saved-post-actions')
  await page.getByRole('button', { name: '続けて検索する' }).click()

  // ---------- 3. Scan tab, camera denied (this context never granted camera) ----------
  await page.getByRole('button', { name: 'スキャン', exact: true }).click()
  await page.waitForTimeout(1500)
  await shot(page, '08-scan-tab-camera-denied')
  await axe(page, '08-scan-tab-camera-denied')

  // ---------- 4. Scan tab, camera granted (fake device) ----------
  const camCtx = await camBrowser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP', permissions: ['camera'] })
  const camPage = await camCtx.newPage()
  await camPage.goto(APP + '/')
  await camPage.evaluate((t) => localStorage.setItem('yomuyo_token', t), token)
  await camPage.goto(APP + '/')
  await camPage.getByRole('button', { name: 'スキャン', exact: true }).click()
  await camPage.waitForTimeout(2500)
  await shot(camPage, '09-scan-tab-camera-granted', { full: false })
  await axe(camPage, '09-scan-tab-camera-granted')
  await camCtx.close()
  await camBrowser.close()

  // ---------- 5. BookList ----------
  await page.getByRole('navigation').getByRole('button', { name: '一覧' }).click()
  await page.locator('a[href^="/books/"]').first().waitFor()
  await shot(page, '10-booklist-grid')
  await axe(page, '10-booklist-grid')
  await page.getByRole('button', { name: 'タグ別表示' }).click()
  await shot(page, '11-booklist-by-tag')
  await axe(page, '11-booklist-by-tag')
  await page.getByRole('button', { name: '一覧表示' }).click()
  await page.getByRole('button', { name: '読了' }).first().click()
  await page.getByRole('button', { name: '再読したい' }).click()
  await shot(page, '12-booklist-filtered-read-tag')
  await page.getByRole('button', { name: 'すべて' }).click()
  await page.getByRole('button', { name: '再読したい' }).click()
  await page.locator('summary', { hasText: 'メモから検索' }).click()
  await page.getByPlaceholder(/メモから検索/).fill('旅行')
  await page.locator('details form').getByRole('button', { name: '検索' }).click()
  await page.getByRole('button', { name: 'クリア' }).waitFor()
  await shot(page, '13-booklist-memo-ai-search')
  await page.getByRole('button', { name: 'クリア' }).click()
  await page.getByPlaceholder('タイトル・著者名で検索').fill('zzzz該当なし')
  await page.getByText('見つかりませんでした').waitFor()
  await shot(page, '14-booklist-no-match', { full: false })
  await page.getByPlaceholder('タイトル・著者名で検索').fill('')

  // ---------- 6. BookDetail ----------
  await page.goto(`${APP}/books/${ids['羅生門・鼻']}`)
  await page.locator('summary', { hasText: '収録作品を青空文庫で読む' }).waitFor()
  await shot(page, '15-bookdetail-aozora-collapsed')
  await axe(page, '15-bookdetail-aozora-collapsed')
  await page.locator('summary', { hasText: '収録作品を青空文庫で読む' }).click()
  await shot(page, '16-bookdetail-aozora-expanded')
  await axe(page, '16-bookdetail-aozora-expanded')

  await page.goto(`${APP}/books/${ids['こころ']}`)
  await page.getByText('青空文庫で読む').waitFor()
  await shot(page, '17-bookdetail-aozora-single')

  // status change -> post-save actions appear
  await page.locator('select').selectOption('purchased')
  await page.getByRole('button', { name: '一覧を見る' }).waitFor()
  await shot(page, '18-bookdetail-after-status-change')
  await axe(page, '18-bookdetail-after-status-change')

  // ISBN-less book: no bookstore links
  await page.goto(`${APP}/books/${ids['ISBNのない同人誌サンプル']}`)
  await page.getByRole('button', { name: '削除', exact: true }).waitFor()
  await shot(page, '19-bookdetail-no-isbn')

  // no cover book
  await page.goto(`${APP}/books/${ids['銃・病原菌・鉄（上） 1万3000年にわたる人類史の謎']}`)
  await page.getByRole('button', { name: '削除', exact: true }).waitFor()
  await shot(page, '20-bookdetail-no-cover')

  // ---------- 7. Settings ----------
  await page.goto(APP + '/')
  await page.getByRole('navigation').getByRole('button', { name: '設定' }).click()
  await page.getByText('復旧コード', { exact: true }).waitFor()
  await shot(page, '21-settings')
  await axe(page, '21-settings')

  // ---------- 8. /b/{token} entry on a fresh browser profile ----------
  const entryCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP' })
  const entryPage = await entryCtx.newPage()
  await entryPage.goto(`${APP}/b/${token}`)
  await entryPage.getByRole('button', { name: 'スキャン', exact: true }).waitFor()
  const landedUrl = entryPage.url()
  const stored = await entryPage.evaluate(() => localStorage.getItem('yomuyo_token'))
  const historyLen = await entryPage.evaluate(() => history.length)
  log('token entry landed at', landedUrl, 'stored matches:', stored === token, 'history.length', historyLen)
  await shot(entryPage, '22-after-secret-url-entry')
  // deep link without token on a fresh profile -> should redirect to onboarding
  const guestCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP' })
  const guestPage = await guestCtx.newPage()
  await guestPage.goto(`${APP}/books/${ids['こころ']}`)
  await guestPage.waitForTimeout(800)
  log('guest deep link landed at', guestPage.url())
  await shot(guestPage, '23-deeplink-without-token', { full: false })
  await guestCtx.close()
  await entryCtx.close()

  // ---------- 9. Recover page ----------
  const recCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP' })
  const recPage = await recCtx.newPage()
  await recPage.goto(APP + '/recover')
  await recPage.getByRole('button', { name: '復元する' }).waitFor()
  await shot(recPage, '24-recover-empty')
  await axe(recPage, '24-recover-empty')
  await recPage.getByPlaceholder('XXXX-XXXX-XXXX').fill('AAAA-BBBB-CCCC')
  await recPage.getByRole('button', { name: '復元する' }).click()
  await recPage.getByText('復旧コードが見つかりませんでした').waitFor()
  await shot(recPage, '25-recover-error')
  await axe(recPage, '25-recover-error')
  await recPage.getByPlaceholder('XXXX-XXXX-XXXX').fill(codeText.toLowerCase())
  await recPage.getByRole('button', { name: '復元する' }).click()
  await recPage.getByRole('button', { name: 'スキャン', exact: true }).waitFor()
  log('recover landed at', recPage.url())
  await shot(recPage, '26-recover-success-bookshelf')
  await recCtx.close()

  // ---------- 10. Desktop + dark mode variants ----------
  const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' })
  const deskPage = await deskCtx.newPage()
  await deskPage.goto(APP + '/')
  await deskPage.evaluate((t) => localStorage.setItem('yomuyo_token', t), token)
  await deskPage.goto(APP + '/')
  await deskPage.getByRole('navigation').getByRole('button', { name: '一覧' }).click()
  await deskPage.locator('a[href^="/books/"]').first().waitFor()
  await shot(deskPage, '27-desktop-booklist', { full: false })
  await deskCtx.close()

  const darkCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, locale: 'ja-JP', colorScheme: 'dark' })
  const darkPage = await darkCtx.newPage()
  await darkPage.goto(APP + '/')
  await darkPage.evaluate((t) => localStorage.setItem('yomuyo_token', t), token)
  await darkPage.goto(APP + '/')
  await darkPage.getByRole('navigation').getByRole('button', { name: '一覧' }).click()
  await darkPage.locator('a[href^="/books/"]').first().waitFor()
  await shot(darkPage, '28-dark-mode-booklist', { full: false })
  await darkPage.goto(`${APP}/books/${ids['羅生門・鼻']}`)
  await darkPage.getByRole('button', { name: '削除', exact: true }).waitFor()
  await shot(darkPage, '29-dark-mode-bookdetail', { full: false })
  await darkCtx.close()

  // small-phone width check (SE-class) for the filter row wrapping
  const seCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, locale: 'ja-JP' })
  const sePage = await seCtx.newPage()
  await sePage.goto(APP + '/')
  await sePage.evaluate((t) => localStorage.setItem('yomuyo_token', t), token)
  await sePage.goto(APP + '/')
  await sePage.getByRole('navigation').getByRole('button', { name: '一覧' }).click()
  await sePage.locator('a[href^="/books/"]').first().waitFor()
  await shot(sePage, '30-small-phone-booklist', { full: false })
  await seCtx.close()

  fs.writeFileSync(path.join(OUT, 'axe-results.json'), JSON.stringify(a11y, null, 2))
  fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2))
  log('console errors:', consoleErrors.length)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
