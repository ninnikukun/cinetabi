// Local stand-in for the yomuyo Supabase Edge Functions.
// Mirrors request/response shapes of supabase/functions/* so the real frontend runs unmodified.
const http = require('http')
const crypto = require('crypto')

const PORT = 8787
const tokens = new Map() // token -> { id, recoveryCode }
const books = [] // { ownerId, id, isbn, title, author, authorReading, publisher, coverImageUrl, price, status, memo, tags, createdAt, deletedAt, aozoraLinks }

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genToken() {
  return crypto.randomBytes(24).toString('base64url')
}
function genRecovery() {
  const b = crypto.randomBytes(12)
  let s = ''
  for (const x of b) s += RECOVERY_ALPHABET[x & 31]
  return s
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-yomuyo-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null)
      } catch {
        resolve(null)
      }
    })
  })
}

function owner(req) {
  const t = req.headers['x-yomuyo-token']
  if (!t) return null
  const rec = tokens.get(t)
  return rec ? rec.id : null
}

function publicBook(b, withDetail) {
  const base = {
    id: b.id,
    isbn: b.isbn,
    title: b.title,
    author: b.author,
    authorReading: b.authorReading,
    publisher: b.publisher,
    coverImageUrl: b.coverImageUrl,
    price: b.price,
    status: b.status,
    tags: b.tags,
    createdAt: b.createdAt,
  }
  if (withDetail) base.memo = b.memo
  return base
}

// Known "aozora matches" keyed by title so seeded books get links like production does.
const AOZORA = {
  '羅生門・鼻': [
    { workId: '000127', title: '羅生門', cardUrl: 'https://www.aozora.gr.jp/cards/000879/card127.html' },
    { workId: '000042', title: '鼻', cardUrl: 'https://www.aozora.gr.jp/cards/000879/card42.html' },
  ],
  'こころ': [{ workId: '000773', title: 'こころ', cardUrl: 'https://www.aozora.gr.jp/cards/000148/card773.html' }],
}

// Placeholder cover art (served locally because external hosts are unreachable in this sandbox).
function coverSvg(n) {
  const palettes = [
    ['#3b2f2f', '#c9a66b'],
    ['#1f3a5f', '#9ec1e8'],
    ['#2d5a27', '#b9e0a5'],
    ['#7a1f1f', '#f0b3b3'],
    ['#4a2c6b', '#d3b8f0'],
    ['#0f4c5c', '#9fd8e0'],
    ['#5c4a0f', '#e8d59f'],
    ['#333', '#ddd'],
  ]
  const [bg, fg] = palettes[n % palettes.length]
  const wide = n === 6 // one deliberately odd aspect ratio to exercise objectFit
  const w = wide ? 400 : 300
  const h = wide ? 300 : 450
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="${fg}" stroke-width="3"/>
  <text x="50%" y="48%" fill="${fg}" font-family="serif" font-size="34" text-anchor="middle">COVER</text>
  <text x="50%" y="60%" fill="${fg}" font-family="serif" font-size="22" text-anchor="middle">No. ${n + 1}</text>
</svg>`
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS)
    return res.end('ok')
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const name = url.pathname.replace(/^\//, '')

  if (name.startsWith('covers/')) {
    const n = parseInt(name.split('/')[1], 10) || 0
    res.writeHead(200, { ...CORS, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' })
    return res.end(coverSvg(n))
  }

  if (name === 'health') return json(res, 200, { ok: true })

  if (name === 'create-token') {
    const token = genToken()
    const recoveryCode = genRecovery()
    tokens.set(token, { id: crypto.randomUUID(), recoveryCode })
    console.log(`[mock] create-token -> ${token} / ${recoveryCode}`)
    return json(res, 200, { token, recoveryCode })
  }

  if (name === 'recover-access') {
    const body = await readBody(req)
    if (!body?.recoveryCode) return json(res, 400, { error: 'recoveryCode is required' })
    const normalized = body.recoveryCode.replace(/[-\s]/g, '').toUpperCase()
    for (const [token, rec] of tokens) if (rec.recoveryCode === normalized) return json(res, 200, { token })
    return json(res, 404, { error: 'not found' })
  }

  if (name === 'lookup-google-books' || name === 'ndl-cover') return json(res, 404, { error: 'not found' })

  if (name === 'search-title') {
    const body = await readBody(req)
    if (!body?.query?.trim()) return json(res, 400, { error: 'query is required' })
    const q = body.query.trim()
    return json(res, 200, [
      { volumeId: 'v1', isbn: '9784101025018', title: `${q}`, author: '芥川龍之介', thumbnailUrl: `http://127.0.0.1:${PORT}/covers/0.svg` },
      { volumeId: 'v2', isbn: '9784101025025', title: `${q}・蜘蛛の糸・杜子春`, author: '芥川龍之介', thumbnailUrl: `http://127.0.0.1:${PORT}/covers/3.svg` },
      { volumeId: 'v3', isbn: null, title: `${q}を読む ― 近代文学入門`, author: '文学研究会', thumbnailUrl: null },
      { volumeId: 'v4', isbn: '9784003107010', title: `${q}（岩波文庫）`, author: '芥川竜之介', thumbnailUrl: `http://127.0.0.1:${PORT}/covers/4.svg` },
    ])
  }

  // ---- token-protected below ----
  const ownerId = owner(req)
  if (!ownerId) return json(res, 404, { error: 'not found' })
  const mine = () => books.filter((b) => b.ownerId === ownerId && !b.deletedAt)

  if (name === 'get-account') {
    const rec = tokens.get(req.headers['x-yomuyo-token'])
    return json(res, 200, { recoveryCode: rec.recoveryCode })
  }

  if (name === 'list-books') {
    return json(res, 200, mine().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((b) => publicBook(b, false)))
  }

  if (name === 'get-tags') {
    const set = new Set()
    for (const b of mine()) for (const t of b.tags) set.add(t)
    return json(res, 200, Array.from(set).sort((a, b) => a.localeCompare(b, 'ja')))
  }

  if (name === 'get-book') {
    const body = await readBody(req)
    const b = mine().find((x) => x.id === body?.id)
    if (!b) return json(res, 404, { error: 'not found' })
    return json(res, 200, { ...publicBook(b, true), aozoraLinks: b.aozoraLinks })
  }

  if (name === 'save-book') {
    const body = await readBody(req)
    if (!body?.isbn || !body.title) return json(res, 400, { error: 'isbn and title are required' })
    if (mine().some((b) => b.isbn === body.isbn)) return json(res, 409, { error: 'already saved' })
    const b = {
      ownerId,
      id: crypto.randomUUID(),
      isbn: body.isbn,
      title: body.title,
      author: body.author ?? null,
      authorReading: body.authorReading ?? null,
      publisher: body.publisher ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      price: body.price ?? null,
      status: body.status ?? 'wishlist',
      memo: null,
      tags: body.tags ?? [],
      createdAt: body.__createdAt ?? new Date().toISOString(),
      deletedAt: null,
      aozoraLinks: AOZORA[body.title] ?? [],
    }
    books.push(b)
    return json(res, 200, publicBook(b, false))
  }

  if (name === 'update-book') {
    const body = await readBody(req)
    const b = mine().find((x) => x.id === body?.id)
    if (!b) return json(res, 404, { error: 'not found' })
    if (body.status !== undefined) b.status = body.status
    if (body.memo !== undefined) b.memo = body.memo
    if (body.tags !== undefined) b.tags = body.tags
    return json(res, 200, publicBook(b, true))
  }

  if (name === 'delete-book') {
    const body = await readBody(req)
    const b = mine().find((x) => x.id === body?.id)
    if (!b) return json(res, 404, { error: 'not found' })
    b.deletedAt = new Date().toISOString()
    return json(res, 200, { id: b.id })
  }

  if (name === 'search-books') {
    const body = await readBody(req)
    const q = (body?.query ?? '').trim()
    const hits = mine().filter((b) => b.memo && b.memo.includes(q))
    return json(res, 200, hits.map((b) => ({ id: b.id, title: b.title, author: b.author })))
  }

  json(res, 404, { error: `unknown function ${name}` })
})

server.listen(PORT, '127.0.0.1', () => console.log(`[mock] functions listening on http://127.0.0.1:${PORT}`))
