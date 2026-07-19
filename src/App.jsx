import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase.js";

/* ─────────────────────────────────────────────────────────────
   シネたび — 映画の記録と、でかける先の映画館さがし
   ・タイトル検索で登録（ポスター自動表示／TMDB）
   ・初回はランダム表示から「観た作品」を選んで素早く記録
   ・「でかける」で、選んだエリアの映画館を徒歩の所要時間でしぼって一覧
   ・記録は端末に保存（localStorage）
   ・映画データは /api/tmdb 経由で TMDB から取得。キー未設定時はデモデータで動作。
   ───────────────────────────────────────────────────────────── */

/* ── TMDB ── */
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_GENRES = {
  28:"アクション",12:"アドベンチャー",16:"アニメ",35:"コメディ",80:"犯罪",
  99:"ドキュメンタリー",18:"ドラマ",10751:"ファミリー",14:"ファンタジー",36:"歴史",
  27:"ホラー",10402:"音楽",9648:"ミステリー",10749:"ロマンス",878:"SF",
  10770:"TV映画",53:"スリラー",10752:"戦争",37:"西部劇",
};
function fromTMDB(m) {
  return {
    id: "t" + m.id,
    title: m.title || m.original_title || "",
    year: (m.release_date || "").slice(0, 4),
    genres: (m.genre_ids || []).map(g => TMDB_GENRES[g]).filter(Boolean).slice(0, 3),
    posterPath: m.poster_path || null,
  };
}
async function searchFilms(q) {
  const query = q.trim();
  if (!query) return [];
  try {
    const r = await fetch(`/api/tmdb?action=search&q=${encodeURIComponent(query)}`);
    const d = await r.json();
    if (d && Array.isArray(d.results) && d.results.length) {
      return d.results.filter(m => m.title || m.original_title).slice(0, 14).map(fromTMDB);
    }
  } catch {}
  // フォールバック（デモ）
  const qq = query.replace(/\s/g, "");
  return FILMS.filter(f => f.title.replace(/\s/g, "").includes(qq)).slice(0, 14);
}
async function popularFilms() {
  try {
    const r = await fetch(`/api/tmdb?action=popular`);
    const d = await r.json();
    if (d && Array.isArray(d.results) && d.results.length) {
      return d.results.filter(m => m.poster_path && (m.title || m.original_title)).slice(0, 20).map(fromTMDB);
    }
  } catch {}
  return [...FILMS].sort(() => Math.random() - 0.5).slice(0, 20);
}

/* ── デモ用フォールバック作品（TMDB未設定でも動くように） ── */
const FILMS = [
  { id:"f1", title:"インセプション", year:"2010", genres:["SF","アクション","スリラー"], posterPath:null },
  { id:"f2", title:"インターステラー", year:"2014", genres:["SF","ドラマ"], posterPath:null },
  { id:"f3", title:"パラサイト 半地下の家族", year:"2019", genres:["スリラー","ドラマ","コメディ"], posterPath:null },
  { id:"f4", title:"ラ・ラ・ランド", year:"2016", genres:["ロマンス","ドラマ"], posterPath:null },
  { id:"f5", title:"君の名は。", year:"2016", genres:["アニメ","ロマンス","ファンタジー"], posterPath:null },
  { id:"f6", title:"千と千尋の神隠し", year:"2001", genres:["アニメ","ファンタジー"], posterPath:null },
  { id:"f7", title:"ジョーカー", year:"2019", genres:["ドラマ","スリラー"], posterPath:null },
  { id:"f8", title:"マッドマックス 怒りのデス・ロード", year:"2015", genres:["アクション","SF"], posterPath:null },
  { id:"f9", title:"ショーシャンクの空に", year:"1994", genres:["ドラマ"], posterPath:null },
  { id:"f10", title:"アベンジャーズ／エンドゲーム", year:"2019", genres:["アクション","SF","ファンタジー"], posterPath:null },
  { id:"f11", title:"タイタニック", year:"1997", genres:["ロマンス","ドラマ"], posterPath:null },
  { id:"f12", title:"ダークナイト", year:"2008", genres:["アクション","スリラー","ドラマ"], posterPath:null },
  { id:"f13", title:"セッション", year:"2014", genres:["ドラマ"], posterPath:null },
  { id:"f14", title:"ボヘミアン・ラプソディ", year:"2018", genres:["ドラマ"], posterPath:null },
  { id:"f15", title:"グランド・ブダペスト・ホテル", year:"2014", genres:["コメディ","ドラマ"], posterPath:null },
  { id:"f16", title:"ゲット・アウト", year:"2017", genres:["ホラー","スリラー"], posterPath:null },
  { id:"f17", title:"ヘレディタリー／継承", year:"2018", genres:["ホラー"], posterPath:null },
  { id:"f18", title:"ナイブズ・アウト", year:"2019", genres:["ミステリー","コメディ"], posterPath:null },
  { id:"f19", title:"バック・トゥ・ザ・フューチャー", year:"1985", genres:["SF","コメディ","アクション"], posterPath:null },
  { id:"f20", title:"ハリー・ポッターと賢者の石", year:"2001", genres:["ファンタジー"], posterPath:null },
  { id:"f21", title:"ロード・オブ・ザ・リング", year:"2001", genres:["ファンタジー","アクション"], posterPath:null },
  { id:"f22", title:"スター・ウォーズ／新たなる希望", year:"1977", genres:["SF","アクション","ファンタジー"], posterPath:null },
  { id:"f23", title:"アナと雪の女王", year:"2013", genres:["アニメ","ファンタジー"], posterPath:null },
  { id:"f24", title:"トイ・ストーリー", year:"1995", genres:["アニメ","コメディ"], posterPath:null },
  { id:"f25", title:"君たちはどう生きるか", year:"2023", genres:["アニメ","ファンタジー"], posterPath:null },
  { id:"f26", title:"すずめの戸締まり", year:"2022", genres:["アニメ","ファンタジー","青春"], posterPath:null },
  { id:"f27", title:"怪物", year:"2023", genres:["ドラマ","ミステリー"], posterPath:null },
  { id:"f28", title:"ドライブ・マイ・カー", year:"2021", genres:["ドラマ"], posterPath:null },
  { id:"f29", title:"万引き家族", year:"2018", genres:["ドラマ"], posterPath:null },
  { id:"f30", title:"花束みたいな恋をした", year:"2021", genres:["ロマンス","青春","ドラマ"], posterPath:null },
  { id:"f31", title:"聲の形", year:"2016", genres:["アニメ","青春","ドラマ"], posterPath:null },
  { id:"f32", title:"天気の子", year:"2019", genres:["アニメ","ロマンス","ファンタジー"], posterPath:null },
  { id:"f33", title:"セブン", year:"1995", genres:["スリラー","ミステリー"], posterPath:null },
  { id:"f34", title:"ゴーン・ガール", year:"2014", genres:["スリラー","ミステリー","ドラマ"], posterPath:null },
  { id:"f35", title:"ジョン・ウィック", year:"2014", genres:["アクション","スリラー"], posterPath:null },
  { id:"f36", title:"トップガン マーヴェリック", year:"2022", genres:["アクション","ドラマ"], posterPath:null },
];

/* ── 映画館（デモ：エリア＋駅から徒歩分。本番はアクセス情報から作成） ── */
const AREAS = ["渋谷","新宿","池袋","下北沢","吉祥寺"];
const CINEMAS = [
  { id:"c1", area:"渋谷", name:"シネクエスト渋谷", walk:6 },
  { id:"c2", area:"渋谷", name:"道玄坂ミニシアター", walk:12 },
  { id:"c3", area:"渋谷", name:"宮益坂シネマ8", walk:16 },
  { id:"c4", area:"新宿", name:"新宿セントラル座", walk:5 },
  { id:"c5", area:"新宿", name:"歌舞伎町ナイトシネマ", walk:14 },
  { id:"c6", area:"池袋", name:"サンシャイン通り劇場", walk:9 },
  { id:"c7", area:"池袋", name:"西口アートシアター", walk:18 },
  { id:"c8", area:"下北沢", name:"下北フィルム小屋", walk:7 },
  { id:"c9", area:"下北沢", name:"南口名画座", walk:15 },
  { id:"c10", area:"吉祥寺", name:"井の頭シネマテーク", walk:8 },
  { id:"c11", area:"吉祥寺", name:"ハモニカ横丁座", walk:13 },
];

/* ── 好みプロファイル（現在は休眠中・将来のおすすめ機能用に保持） ── */
function movieWeight(m) {
  let w = 1;
  if (m.image) w += 1.5;
  const len = (m.note || "").trim().length;
  if (len > 0) w += Math.min(2, len / 40);
  return w;
}
function tasteProfile(movies) {
  const w = {};
  movies.forEach(m => { const mw = movieWeight(m); (m.genres || []).forEach(g => { w[g] = (w[g] || 0) + mw; }); });
  return w;
}

/* ── 自動生成ポスター（TMDB画像が無い場合のフォールバック） ── */
function posterColors(title) {
  let h = 0; for (let i = 0; i < (title || "").length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return { a:`hsl(${h} 46% 30%)`, b:`hsl(${(h+38)%360} 52% 15%)`, accent:`hsl(${h} 72% 64%)` };
}
function Poster({ film, big, style }) {
  if (film.posterPath) {
    return (
      <div style={{ aspectRatio:"2 / 3", borderRadius: big?12:8, overflow:"hidden", background:"var(--surface2)", ...style }}>
        <img src={TMDB_IMG + film.posterPath} alt={film.title} loading="lazy" draggable={false} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
    );
  }
  const c = posterColors(film.title);
  return (
    <div style={{ position:"relative", aspectRatio:"2 / 3", borderRadius: big?12:8, overflow:"hidden", background:`linear-gradient(155deg, ${c.a}, ${c.b})`, ...style }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:6, opacity:.55, background:`repeating-linear-gradient(90deg, ${c.accent} 0 5px, transparent 5px 11px)` }} />
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"flex-end", padding: big?14:8 }}>
        <div style={{ fontWeight:900, lineHeight:1.22, fontSize: big?21:12.5, color:"#fff", textShadow:"0 2px 10px rgba(0,0,0,.55)" }}>{film.title}</div>
        {film.year && <div className="reel-mark" style={{ fontSize: big?13:10, color:"#fff", opacity:.78, marginTop:4, letterSpacing:".08em" }}>{film.year}</div>}
      </div>
    </div>
  );
}

/* ── フィルムのコマ（16:9）：ぼかし背景＋中央ポスター、または おもいで写真を全面 ── */
function FilmFrame({ m, showPhoto, code, style, onClick }) {
  const usePhoto = showPhoto && m.image;
  const posterUrl = m.posterPath ? TMDB_IMG + m.posterPath : null;
  const c = posterColors(m.title);
  return (
    <div className="film-frame" style={style} onClick={onClick}>
      {usePhoto ? (
        <img src={m.image} alt="" draggable={false} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
      ) : posterUrl ? (
        <>
          <div className="blur" style={{ backgroundImage:`url(${posterUrl})` }} />
          <img className="core" src={posterUrl} alt={m.title} loading="lazy" draggable={false} />
        </>
      ) : (
        <>
          <div className="blur" style={{ background:`linear-gradient(120deg, ${c.a}, ${c.b})` }} />
          <div className="core" style={{ background:`linear-gradient(160deg, ${c.a}, ${c.b})`, display:"flex", alignItems:"flex-end", padding:6 }}>
            <span style={{ fontWeight:900, fontSize:11, color:"#fff", lineHeight:1.2, textShadow:"0 1px 6px rgba(0,0,0,.6)" }}>{m.title}</span>
          </div>
        </>
      )}
      {m.image && !usePhoto && <span className="mem">MEM</span>}
      {usePhoto && <span className="mem">MEM</span>}
      {code && <span className="no">{code}</span>}
    </div>
  );
}

/* フィルムのコマ番号（12A形式）。indexから通し番号を作る */
function frameCode(i) { return String(i + 1).padStart(2, "0") + "A"; }

const store = {
  get(key) { try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); } catch { return null; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
};

/* ── 写真を縮小して軽い base64 に ── */
function resizeImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Space+Mono:wght@400;700&display=swap');
* { box-sizing: border-box; }
body { margin:0; }
img { -webkit-user-drag:none; user-select:none; }
.reel-root {
  --bg:#0c0d16; --bg2:#13141f; --surface:#1a1c2b; --surface2:#22243a;
  --amber:#e8b04b; --amber-dim:#b98a35; --rose:#d4564e;
  --ink:#f2ebdd; --ink-dim:#9a9fbb; --line:#2c2f44;
  font-family:'Zen Kaku Gothic New', system-ui, sans-serif;
  color:var(--ink); background:var(--bg); min-height:100vh;
  max-width:520px; margin:0 auto; position:relative;
}
.reel-mark { font-family:'Oswald', sans-serif; }
.reel-grid { display:flex; flex-direction:column; gap:14px; }
.reel-narrow { max-width:560px; margin:0 auto; }
.reel-sheet { width:100%; max-width:560px; margin:0 auto; }
.reel-photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
.reel-feed { scrollbar-width:none; }
.reel-feed::-webkit-scrollbar { display:none; }
.reel-post { min-height:100vh; min-height:100dvh; }
.reel-carousel { scrollbar-width:none; }
.reel-carousel::-webkit-scrollbar { display:none; }
/* ── フィルム・ルック ── */
.film-body { display:flex; background:#0e0c07; }
.film-spro { width:12px; flex-shrink:0; background-color:#17130b; background-image:repeating-linear-gradient(180deg, transparent 0 10px, #0a0a09 10px 20px); }
.film-track { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; padding:5px 3px; }
.film-frame { position:relative; overflow:hidden; aspect-ratio:16/9; background:#101010; }
.film-frame .blur { position:absolute; inset:-16px; filter:blur(11px) brightness(.55) saturate(.9); background-size:cover; background-position:center; }
.film-frame .core { position:absolute; top:0; bottom:0; left:50%; transform:translateX(-50%); aspect-ratio:2/3; height:100%; box-shadow:0 0 0 1px rgba(0,0,0,.55); object-fit:cover; }
.film-frame .no { position:absolute; bottom:3px; right:5px; font-family:'Space Mono',ui-monospace,monospace; font-size:8px; color:#a9863c; letter-spacing:.04em; }
.film-frame .mem { position:absolute; bottom:3px; left:5px; font-family:'Space Mono',ui-monospace,monospace; font-size:8px; color:#a9863c; letter-spacing:.06em; }
.mono { font-family:'Space Mono',ui-monospace,monospace; }
@media (prefers-reduced-motion: no-preference){ .fade-up{ animation:fadeUp .42s cubic-bezier(.2,.7,.2,1) both; } .reel-detail-enter{ animation:detailIn .3s cubic-bezier(.2,.8,.2,1) both; } }
@keyframes fadeUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:none;} }
@keyframes detailIn{ from{opacity:0; transform:scale(.96);} to{opacity:1; transform:none;} }
@media (min-width: 900px){
  .reel-root { max-width:1000px; }
  .reel-grid { display:grid; grid-template-columns:1fr 1fr; align-items:start; }
  .reel-photo-grid { grid-template-columns:repeat(5,1fr); }
  .reel-fab { left:auto !important; right:32px !important; transform:none !important; width:auto !important; padding-left:28px !important; padding-right:28px !important; }
}
.reel-btn:focus-visible, .reel-tap:focus-visible, input:focus-visible, textarea:focus-visible { outline:2px solid var(--amber); outline-offset:2px; }
.reel-btn, .reel-tap { transition:transform .12s ease, opacity .12s ease; -webkit-tap-highlight-color:transparent; }
.reel-btn:active, .reel-tap:active { transform:scale(.96); opacity:.88; }
`;

/* ─────────── ロゴ ─────────── */
function Wordmark({ size = 22 }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:9 }}>
      <span style={{ fontSize:size, fontWeight:900, letterSpacing:".04em", color:"var(--ink)" }}>シネたび</span>
      <span className="reel-mark" style={{ fontSize:size*0.46, letterSpacing:".26em", color:"var(--amber)" }}>CINETABI</span>
    </div>
  );
}

/* ─────────── 初回オンボーディング ─────────── */
function Onboarding({ onDone }) {
  const [sample, setSample] = useState(null);
  const [picked, setPicked] = useState({});
  useEffect(() => { let alive = true; popularFilms().then(f => { if (alive) setSample(f); }); return () => { alive = false; }; }, []);

  const toggle = (id) => setPicked(p => ({ ...p, [id]: !p[id] }));
  const count = Object.values(picked).filter(Boolean).length;

  const finish = () => {
    const now = new Date().toISOString();
    const byId = Object.fromEntries((sample || []).map(f => [f.id, f]));
    const records = Object.keys(picked).filter(k => picked[k]).map(id => {
      const f = byId[id];
      return { id:"m"+id+Date.now(), filmId:id, title:f.title, year:f.year, posterPath:f.posterPath, genres:f.genres, note:"", watchedAt:now, source:"onboarding" };
    });
    onDone(records);
  };

  return (
    <div style={{ padding:"22px 16px 130px" }}>
      <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>WELCOME TO シネたび</div>
      <h2 style={{ margin:"8px 0 6px", fontSize:21, lineHeight:1.4 }}>観たことのある映画を選んでください</h2>
      <p style={{ margin:"0 0 18px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.7 }}>あとからいつでも記録できます。気軽に選んでください。</p>

      {sample === null ? (
        <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"40px" }}>読み込み中…</p>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
          {sample.map(f => {
            const on = picked[f.id];
            return (
              <button key={f.id} className="reel-tap" onClick={()=>toggle(f.id)} style={{ position:"relative", padding:0, border:"none", background:"none", cursor:"pointer", borderRadius:8 }}>
                <Poster film={f} style={{ outline: on ? "3px solid var(--amber)" : "1px solid var(--line)", outlineOffset:-1 }} />
                {on && <div style={{ position:"absolute", top:6, right:6, width:24, height:24, borderRadius:"50%", background:"var(--amber)", color:"#1a1305", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14 }}>✓</div>}
                {on && <div style={{ position:"absolute", inset:0, borderRadius:8, background:"rgba(232,176,75,.14)" }} />}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", maxWidth:520, width:"100%", padding:"14px 16px 22px", background:"linear-gradient(0deg, var(--bg) 70%, transparent)" }}>
        <button className="reel-btn" disabled={count===0} onClick={finish}
          style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700,
            background: count? "var(--amber)":"var(--surface2)", color: count? "#1a1305":"var(--ink-dim)" }}>
          {count ? `${count}本を登録してはじめる` : "観た作品を選んでください"}
        </button>
        <button className="reel-tap" onClick={()=>onDone([])} style={{ width:"100%", marginTop:10, padding:"10px", background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>スキップ</button>
      </div>
    </div>
  );
}

/* ─────────── 共有 ─────────── */
function ShareSheet({ movie, user, onClose }) {
  const film = { title:movie.title, posterPath:movie.posterPath || null, year:movie.year };
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ t:movie.title, n:movie.note, f:movie.filmId, u:user?.name }))));
      return origin + "/s#" + payload;
    } catch { return origin; }
  }, [movie, user]);

  const shareText = `「${movie.title}」を観た${movie.note ? " — " + movie.note.slice(0,50) : ""}`;

  const drawCard = (photo) => {
    const W = 1080, H = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const c = posterColors(movie.title);
    ctx.fillStyle = "#0c0d16"; ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = "#f2ebdd"; ctx.font = "900 46px system-ui, sans-serif";
    ctx.fillText("シネたび", 80, 118);
    const bw = ctx.measureText("シネたび").width;
    ctx.fillStyle = "#e8b04b"; ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText("CINETABI", 80 + bw + 16, 116);

    const pw = 430, ph = 645, px = (W - pw) / 2, py = 170;
    const r = 20; ctx.beginPath();
    ctx.moveTo(px+r,py); ctx.arcTo(px+pw,py,px+pw,py+ph,r); ctx.arcTo(px+pw,py+ph,px,py+ph,r); ctx.arcTo(px,py+ph,px,py,r); ctx.arcTo(px,py,px+pw,py,r); ctx.closePath();
    if (photo) {
      ctx.save(); ctx.clip();
      const ir = photo.width / photo.height, rr = pw / ph;
      let dw, dh, dx, dy;
      if (ir > rr) { dh = ph; dw = ph * ir; dx = px - (dw - pw) / 2; dy = py; }
      else { dw = pw; dh = pw / ir; dx = px; dy = py - (dh - ph) / 2; }
      ctx.drawImage(photo, dx, dy, dw, dh);
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
      g.addColorStop(0, c.a); g.addColorStop(1, c.b);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "900 40px system-ui, sans-serif";
      wrapLines(ctx, movie.title, pw - 56).slice(-3).forEach((ln, i, arr) => ctx.fillText(ln, px + 28, py + ph - 40 - (arr.length-1-i)*48));
    }

    ctx.textAlign = "center";
    let y = py + ph + 96;
    ctx.fillStyle = "#f2ebdd"; ctx.font = "700 58px system-ui, sans-serif";
    wrapLines(ctx, movie.title, W - 160).slice(0,2).forEach(ln => { ctx.fillText(ln, W/2, y); y += 70; });

    if (movie.note) {
      ctx.textAlign = "center"; ctx.fillStyle = "#9a9fbb"; ctx.font = "400 32px system-ui, sans-serif";
      y += 30; const lines = wrapLines(ctx, movie.note, W - 200);
      lines.slice(0,5).forEach((ln, i) => ctx.fillText(i===4 && lines.length>5 ? ln+"…" : ln, W/2, y + i*46));
    }

    ctx.textAlign = "center"; ctx.fillStyle = "#6b6f88"; ctx.font = "500 28px system-ui, sans-serif";
    ctx.fillText((user?.name ? user.name + "・" : "") + new Date(movie.watchedAt).toLocaleDateString("ja-JP"), W/2, H - 72);
    return cv;

    function wrapLines(ctx, text, maxW) {
      const out = []; let line = "";
      for (const ch of [...String(text)]) {
        if (ch === "\n") { out.push(line); line = ""; continue; }
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
        else line += ch;
      }
      if (line) out.push(line);
      return out;
    }
  };

  const shareImage = () => {
    const render = (photo) => drawCard(photo).toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "cinetabi.png", { type: "image/png" });
      try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: movie.title, text: shareText });
          return;
        }
      } catch {}
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "cinetabi.png"; a.click();
    }, "image/png");

    if (movie.image) {
      const im = new Image();
      im.onload = () => render(im);
      im.onerror = () => render(null);
      im.src = movie.image;
    } else render(null);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  };
  const open = (url) => { try { window.open(url, "_blank", "noopener"); } catch {} };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={onClose}>
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", touchAction:"pan-y", overscrollBehaviorX:"none", padding:"8px 20px 28px" }}>
        <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:14 }}>SHARE ／ この記録を共有</div>

        <div style={{ display:"flex", gap:14, background:"var(--surface)", border:"1px solid var(--line)", borderRadius:14, padding:14, marginBottom:18 }}>
          {movie.image ? <img src={movie.image} alt="" style={{ width:84, flexShrink:0, borderRadius:8, aspectRatio:"2 / 3", objectFit:"cover" }} /> : <Poster film={film} style={{ width:84, flexShrink:0 }} />}
          <div style={{ flex:1, minWidth:0 }}>
            <h3 style={{ margin:0, fontSize:17, fontWeight:700 }}>{movie.title}</h3>
            {movie.note && <p style={{ margin:"6px 0 0", color:"var(--ink-dim)", fontSize:13, lineHeight:1.6, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{movie.note}</p>}
            <div className="reel-mark" style={{ fontSize:11, color:"var(--ink-dim)", marginTop:6 }}>{user?.name ? user.name + "・" : ""}{new Date(movie.watchedAt).toLocaleDateString("ja-JP")}</div>
          </div>
        </div>

        <button className="reel-btn" onClick={shareImage} style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:10 }}>画像にして共有</button>

        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <button className="reel-tap" onClick={()=>open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`)} style={snsBtn}>X で共有</button>
          <button className="reel-tap" onClick={()=>open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`)} style={snsBtn}>LINE で共有</button>
        </div>

        <label style={lbl}>共有リンク</label>
        <div style={{ display:"flex", gap:8 }}>
          <input readOnly value={link} onFocus={e=>e.target.select()} style={{ ...inp, marginBottom:0, fontSize:13, flex:1 }} />
          <button className="reel-tap" onClick={copyLink} style={{ flexShrink:0, padding:"0 16px", borderRadius:10, border:"1px solid var(--line)", background: copied?"var(--amber)":"var(--surface)", color: copied?"#1a1305":"var(--ink)", fontWeight:700, fontSize:13, cursor:"pointer" }}>{copied ? "コピー済" : "コピー"}</button>
        </div>
        <p style={{ margin:"10px 0 0", color:"var(--ink-dim)", fontSize:12, lineHeight:1.6 }}>※ リンク先の共有ページは未実装です（画像での共有は使えます）。</p>
      </div>
    </div>
  );
}

/* ─────────── ユーザー登録 ─────────── */
function Registration({ onRegister }) {
  const [name, setName] = useState("");
  const id = useMemo(() => {
    const raw = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return "usr_" + raw.replace(/-/g, "").slice(0, 12);
  }, []);

  return (
    <div style={{ padding:"40px 24px" }}>
      <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>CREATE PROFILE</div>
      <h2 style={{ margin:"8px 0 6px", fontSize:22, lineHeight:1.4 }}>はじめまして。<br/>お名前を教えてください</h2>
      <p style={{ margin:"0 0 22px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.7 }}>表示名は記録に表示されます。あとから変更できます。</p>

      <label style={lbl}>名前（表示名）</label>
      <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="例：たろう" maxLength={24} style={inp} />

      <div style={{ display:"flex", alignItems:"center", gap:10, background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10, padding:"12px 13px", marginBottom:18 }}>
        <span style={{ fontSize:18 }}>🔑</span>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, color:"var(--ink-dim)" }}>あなたのID（自動・変更不可）</div>
          <div className="reel-mark" style={{ fontSize:14, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis" }}>{id}</div>
        </div>
      </div>

      <p style={{ margin:"0 0 22px", color:"var(--ink-dim)", fontSize:12, lineHeight:1.7 }}>このアプリが保存するのは表示名のみです。IDはランダムに発行され、個人を特定する情報は含みません。</p>

      <button className="reel-btn" disabled={!name.trim()} onClick={()=>onRegister({ id, name: name.trim(), createdAt: new Date().toISOString() })}
        style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700,
          background: name.trim()?"var(--amber)":"var(--surface2)", color: name.trim()?"#1a1305":"var(--ink-dim)" }}>はじめる</button>
    </div>
  );
}

/* ─────────── 記録の追加（検索して登録） ─────────── */
function AddSheet({ onClose, onSave, existingIds }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    let alive = true; setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchFilms(q);
      if (alive) { setResults(r); setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  // キーボードで検索欄が隠れないよう、フォーカス時にシート先頭までスクロール（inputはsticky指定済み）
  const onSearchFocus = () => {
    setTimeout(() => { inputRef.current?.scrollIntoView({ block:"start", behavior:"smooth" }); }, 260);
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setImage(await resizeImage(file)); }
    catch { alert("写真を読み込めませんでした。別の画像で試してください。"); }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    await onSave({ id:"m"+Date.now(), filmId:selected.id, title:selected.title, year:selected.year, posterPath:selected.posterPath, genres:selected.genres, note:note.trim(), image, watchedAt:new Date().toISOString() });
    setBusy(false); onClose();
  };

  // 何か入力・選択が進んでいる状態＝閉じると失われるものがある状態
  const isDirty = !!selected || note.trim() !== "" || !!image;
  const requestClose = () => { if (isDirty) setConfirmLeave(true); else onClose(); };

  // 投稿フォーム（選択後の画面）だけ：先頭までスクロールしている時に下へ引っ張るとホーム画面へ戻る確認
  const startRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const onTouchStart = (e) => {
    if ((sheetRef.current?.scrollTop || 0) > 2) { startRef.current = null; return; }
    startRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startRef.current == null) return;
    const dy = e.touches[0].clientY - startRef.current;
    if (dy > 0) { setPull(dy); setPulling(true); } else { setPull(0); setPulling(false); }
  };
  const onTouchEnd = () => {
    if (pull > 90) requestClose();
    setPull(0); setPulling(false); startRef.current = null;
  };
  const closeProgress = Math.min(1, pull / 220);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={requestClose}>
      <div ref={sheetRef} className="fade-up reel-sheet" onClick={e=>e.stopPropagation()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", height: selected ? "auto" : "75vh", overflowY:"auto", touchAction:"pan-y", overscrollBehaviorX:"none",
          padding: selected ? "8px 20px 28px" : "0 0 28px",
          transform: pull>0 ? `translateY(${pull}px)` : "none", opacity: pull>0 ? 1-closeProgress*0.3 : 1,
          transition: pulling ? "none" : "transform .2s ease, opacity .2s ease" }}>
        {selected && <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />}

        {!selected ? (
          <>
            <div style={{ position:"sticky", top:0, zIndex:2, background:"var(--bg2)", padding:"10px 20px 12px" }}>
              <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"0 auto 14px" }} />
              <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:14 }}>SEARCH ／ 作品を検索して記録</div>
              <input ref={inputRef} autoFocus onFocus={onSearchFocus} value={query} onChange={e=>setQuery(e.target.value)} placeholder="タイトルで検索（例：君の名は）" style={inp} />
            </div>
            <div style={{ padding:"0 20px" }}>
              {searching && <p style={{ color:"var(--ink-dim)", fontSize:13, textAlign:"center", padding:"10px 0" }}>検索中…</p>}
              {!searching && query.trim() && results.length === 0 && (
                <p style={{ color:"var(--ink-dim)", fontSize:14, textAlign:"center", padding:"24px 0", lineHeight:1.7 }}>該当する作品が見つかりません。<br/>別のタイトルで試してください。</p>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {results.map(f => {
                  const done = existingIds.includes(f.id);
                  return (
                    <button key={f.id} className="reel-tap" disabled={done} onClick={()=>setSelected(f)}
                      style={{ display:"flex", gap:12, alignItems:"center", textAlign:"left", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:12, padding:10, cursor: done?"default":"pointer", opacity: done?.55:1 }}>
                      <Poster film={f} style={{ width:46, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{f.title}</div>
                        <div className="reel-mark" style={{ fontSize:12, color:"var(--ink-dim)" }}>{f.year}{f.genres.length ? "・" + f.genres.join("／") : ""}</div>
                      </div>
                      {done && <span style={{ fontSize:12, color:"var(--amber-dim)", flexShrink:0 }}>記録済み</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <button className="reel-tap" onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer", marginBottom:14, padding:0 }}>← 検索に戻る</button>
            <div style={{ display:"flex", gap:14, marginBottom:18 }}>
              <Poster film={selected} big style={{ width:110, flexShrink:0 }} />
              <div style={{ paddingTop:4 }}>
                <h3 style={{ margin:0, fontSize:18, fontWeight:700, lineHeight:1.3 }}>{selected.title}</h3>
                <div className="reel-mark" style={{ fontSize:13, color:"var(--ink-dim)", margin:"4px 0 10px" }}>{selected.year}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {selected.genres.map(g => <span key={g} style={{ fontSize:12, color:"var(--amber-dim)", border:"1px solid var(--line)", borderRadius:20, padding:"2px 9px" }}>{g}</span>)}
                </div>
              </div>
            </div>

            <label style={lbl}>文章</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder="観て感じたこと、思い出など" style={{ ...inp, resize:"vertical", lineHeight:1.6 }} />

            <label style={lbl}>おもいで（任意・写真1枚）</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display:"none" }} />
            {image ? (
              <div style={{ position:"relative", marginBottom:18 }}>
                <img src={image} alt="" draggable={false} style={{ width:"100%", borderRadius:12, display:"block", maxHeight:320, objectFit:"cover" }} />
                <button className="reel-tap" onClick={()=>{ setImage(null); if (fileRef.current) fileRef.current.value=""; }}
                  style={{ position:"absolute", top:8, right:8, background:"rgba(12,13,22,.82)", color:"var(--ink)", border:"1px solid var(--line)", borderRadius:8, padding:"6px 12px", fontSize:13, cursor:"pointer" }}>削除</button>
              </div>
            ) : (
              <button className="reel-tap" onClick={()=>fileRef.current?.click()}
                style={{ width:"100%", marginBottom:18, padding:"18px", border:"1px dashed var(--line)", borderRadius:12, background:"var(--surface)", color:"var(--ink-dim)", cursor:"pointer", fontSize:14 }}>
                ＋ おもいでの写真を追加（チケット・劇場など）
              </button>
            )}

            <button className="reel-btn" disabled={busy} onClick={save} style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background:"var(--amber)", color:"#1a1305" }}>
              {busy ? "保存中…" : "記録する"}
            </button>
          </>
        )}
      </div>

      {confirmLeave && (
        <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,5,10,.7)", padding:24 }} onClick={e=>e.stopPropagation()}>
          <div className="fade-up" style={{ width:"100%", maxWidth:340, background:"var(--bg2)", border:"1px solid var(--line)", borderRadius:16, padding:"22px 20px" }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>編集内容が保存されていません</div>
            <p style={{ color:"var(--ink-dim)", fontSize:13.5, lineHeight:1.7, margin:"0 0 20px" }}>ホーム画面に戻ると、入力中の内容は失われます。</p>
            <button className="reel-btn" onClick={()=>setConfirmLeave(false)} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:8 }}>編集を続ける</button>
            <button className="reel-tap" onClick={()=>{ setConfirmLeave(false); onClose(); }} style={{ width:"100%", padding:"12px", borderRadius:10, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>ホーム画面に戻る</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 対応ブラウザでは画面の切り替わりをふわっとクロスフェードさせ、「パッ」と切り替わる瞬間を無くす。
// 未対応ブラウザでは通常の即時切り替え（見た目が変わるだけで機能は変わらない）。
function withViewTransition(fn) {
  if (typeof document !== "undefined" && document.startViewTransition) document.startViewTransition(fn);
  else fn();
}

/* ─────────── 記録一覧 ─────────── */

function EditSheet({ movie, onClose, onSave }) {
  const [note, setNote] = useState(movie.note || "");
  const [image, setImage] = useState(movie.image || null);
  const [date, setDate] = useState(() => { try { return new Date(movie.watchedAt).toISOString().slice(0,10); } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const sheetRef = useRef(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const origDate = (() => { try { return new Date(movie.watchedAt).toISOString().slice(0,10); } catch { return ""; } })();
  const isDirty = note !== (movie.note || "") || image !== (movie.image || null) || date !== origDate;
  const requestClose = () => { if (isDirty) setConfirmLeave(true); else onClose(); };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setImage(await resizeImage(file)); } catch { alert("写真の読み込みに失敗しました"); }
    e.target.value = "";
  };
  const save = async () => {
    setBusy(true);
    let watchedAt = movie.watchedAt;
    if (date) { const d = new Date(date + "T12:00:00"); if (!isNaN(d)) watchedAt = d.toISOString(); }
    await onSave({ ...movie, note: note.trim(), image, watchedAt });
    setBusy(false);
    onClose();
  };

  // 先頭までスクロールした状態で下に引っ張るとホーム画面へ戻る（変更があれば確認）
  const startRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const onTouchStart = (e) => {
    if ((sheetRef.current?.scrollTop || 0) > 2) { startRef.current = null; return; }
    startRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startRef.current == null) return;
    const dy = e.touches[0].clientY - startRef.current;
    if (dy > 0) { setPull(dy); setPulling(true); } else { setPull(0); setPulling(false); }
  };
  const onTouchEnd = () => {
    if (pull > 90) requestClose();
    setPull(0); setPulling(false); startRef.current = null;
  };
  const closeProgress = Math.min(1, pull / 220);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={requestClose}>
      <div ref={sheetRef} className="fade-up reel-sheet" onClick={e=>e.stopPropagation()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", touchAction:"pan-y", overscrollBehaviorX:"none",
          padding:"8px 20px 28px",
          transform: pull>0 ? `translateY(${pull}px)` : "none", opacity: pull>0 ? 1-closeProgress*0.3 : 1,
          transition: pulling ? "none" : "transform .2s ease, opacity .2s ease" }}>
        <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:6 }}>EDIT ／ 記録を編集</div>
        <div style={{ fontWeight:900, fontSize:17, marginBottom:16 }}>{movie.title}</div>

        <label style={lbl}>観た日</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...inp, colorScheme:"dark" }} />

        <label style={lbl}>ひとことメモ</label>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} maxLength={500} placeholder="感想や、いっしょに観た人のことなど"
          style={{ ...inp, resize:"vertical", lineHeight:1.7 }} />

        <label style={lbl}>おもいで（写真1枚）</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display:"none" }} />
        {image ? (
          <div style={{ position:"relative", marginBottom:14 }}>
            <img src={image} alt="" draggable={false} style={{ width:"100%", borderRadius:12, display:"block", maxHeight:320, objectFit:"cover" }} />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button className="reel-tap" onClick={()=>fileRef.current?.click()} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:13, cursor:"pointer" }}>写真を変更</button>
              <button className="reel-tap" onClick={()=>setImage(null)} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:13, cursor:"pointer" }}>写真を削除</button>
            </div>
          </div>
        ) : (
          <button className="reel-tap" onClick={()=>fileRef.current?.click()} style={{ width:"100%", padding:"14px", borderRadius:12, border:"1px dashed var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:13.5, cursor:"pointer", marginBottom:14 }}>
            ＋ おもいでの写真を追加（チケット・劇場など）
          </button>
        )}

        <button className="reel-btn" disabled={busy} onClick={save}
          style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background: busy?"var(--surface2)":"var(--amber)", color: busy?"var(--ink-dim)":"#1a1305" }}>
          {busy ? "保存中…" : "保存する"}
        </button>
      </div>

      {confirmLeave && (
        <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,5,10,.7)", padding:24 }} onClick={e=>e.stopPropagation()}>
          <div className="fade-up" style={{ width:"100%", maxWidth:340, background:"var(--bg2)", border:"1px solid var(--line)", borderRadius:16, padding:"22px 20px" }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>編集内容が保存されていません</div>
            <p style={{ color:"var(--ink-dim)", fontSize:13.5, lineHeight:1.7, margin:"0 0 20px" }}>ホーム画面に戻ると、変更した内容は失われます。</p>
            <button className="reel-btn" onClick={()=>setConfirmLeave(false)} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:8 }}>編集を続ける</button>
            <button className="reel-tap" onClick={()=>{ setConfirmLeave(false); onClose(); }} style={{ width:"100%", padding:"12px", borderRadius:10, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>ホーム画面に戻る</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ m, onShare, onDelete, onEdit, readOnly }) {
  const trackRef = useRef(null);
  const [page, setPage] = useState(0);
  const pages = m.image ? ["poster", "photo"] : ["poster"];
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const film = { title:m.title, posterPath:m.posterPath || null, year:m.year };
  const del = () => onDelete(m.id);
  const q = encodeURIComponent(m.title);
  const openExt = (url) => { try { window.open(url, "_blank", "noopener"); } catch {} };

  return (
    <section className="reel-post" style={{ scrollSnapAlign:"start" }}>
      <div style={{ position:"relative" }}>
        <div ref={trackRef} onScroll={onScroll} className="reel-carousel" style={{ display:"flex", overflowX: pages.length>1 ? "auto" : "hidden", scrollSnapType:"x mandatory", WebkitOverflowScrolling:"touch", touchAction:"pan-x" }}>
          <div style={{ minWidth:"100%", scrollSnapAlign:"start" }}>
            <Poster film={film} big style={{ width:"100%", aspectRatio:"2 / 3", borderRadius:0 }} />
          </div>
          {m.image && (
            <div style={{ minWidth:"100%", scrollSnapAlign:"start" }}>
              <img src={m.image} alt="" draggable={false} style={{ width:"100%", aspectRatio:"2 / 3", objectFit:"cover", display:"block" }} />
            </div>
          )}
        </div>
        {pages.length>1 && (
          <div style={{ position:"absolute", top:10, left:0, right:0, display:"flex", justifyContent:"center", gap:5 }}>
            {pages.map((p,idx) => <span key={p} style={{ width: idx===page?16:5, height:5, borderRadius:3, background: idx===page?"var(--amber)":"rgba(255,255,255,.45)", transition:"width .2s ease" }} />)}
          </div>
        )}
        {pages.length>1 && (
          <span style={{ position:"absolute", bottom:10, right:10, fontSize:9, color:"#fff", background:"rgba(0,0,0,.45)", padding:"2px 7px", borderRadius:20 }}>
            {page===0 ? "ポスター" : "おもいで"} ・ スワイプで切替
          </span>
        )}
      </div>

      <div className="reel-narrow" style={{ padding:"16px 16px 40px" }}>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:900, lineHeight:1.3 }}>{m.title}</h2>
        <div className="reel-mark" style={{ fontSize:12.5, color:"var(--ink-dim)" }}>{new Date(m.watchedAt).toLocaleDateString("ja-JP")}{m.year ? ` ・ ${m.year}` : ""}</div>
        {m.genres?.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
            {m.genres.map(g => <span key={g} style={{ fontSize:11.5, color:"var(--amber-dim)", border:"1px solid var(--line)", borderRadius:20, padding:"2px 8px" }}>{g}</span>)}
          </div>
        )}
        {m.note && <p style={{ margin:"14px 0 0", fontSize:15, lineHeight:1.75, whiteSpace:"pre-wrap" }}>{m.note}</p>}
        <div style={{ display:"flex", gap:8, marginTop:18 }}>
          <button className="reel-tap" onClick={()=>openExt(`https://eiga.com/search/${q}/`)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink-dim)", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>映画.comで探す ↗</button>
          <button className="reel-tap" onClick={()=>openExt(`https://filmarks.com/search/movies?q=${q}`)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink-dim)", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>Filmarksで探す ↗</button>
        </div>
        {!readOnly && (
          <div style={{ display:"flex", gap:10, marginTop:10 }}>
            <button className="reel-btn" onClick={()=>onShare(m)} style={{ flex:1, padding:"13px", borderRadius:11, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>共有する</button>
            <button className="reel-tap" onClick={onEdit} style={{ padding:"13px 18px", borderRadius:11, border:"1px solid var(--line)", background:"transparent", color:"var(--ink)", fontSize:14, fontWeight:700, cursor:"pointer" }}>編集</button>
            <button className="reel-tap" onClick={del} style={{ padding:"13px 18px", borderRadius:11, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>削除</button>
          </div>
        )}
      </div>
    </section>
  );
}

function DetailView({ movies, index, onClose, onShare, onDelete, onUpdate, readOnly }) {
  const feedRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const el = feedRef.current;
    const child = el?.children?.[index];
    if (child) child.scrollIntoView({ block:"start" });
  }, []); // 初回だけ、タップした記録の位置までジャンプ

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // 先頭の記録を表示している時だけ、下に引っ張るとホーム画面（記録一覧）に戻る
  const startRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const requestClose = () => {
    setPulling(false);
    setClosing(true);
    setTimeout(onClose, 260); // アニメーションが最後まで終わってから実際に閉じる（切れ目を作らない）
  };
  const onTouchStart = (e) => {
    if (closing || (feedRef.current?.scrollTop || 0) > 2) { startRef.current = null; return; }
    startRef.current = e.touches[0].clientY;
    setBouncing(false);
  };
  const onTouchMove = (e) => {
    if (startRef.current == null) return;
    const raw = e.touches[0].clientY - startRef.current;
    if (raw <= 0) { setPull(0); setPulling(false); return; }
    // ゴムのような伸び：最初は指にほぼ1:1、伸びるほど重くなる（引っ張り抵抗）
    const eased = raw < 180 ? raw : 180 + (raw - 180) * 0.28;
    setPull(eased); setPulling(true);
  };
  const onTouchEnd = () => {
    if (pull > 92) { requestClose(); return; }
    setPulling(false); setBouncing(true); setPull(0);
    startRef.current = null;
  };

  const del = (id) => { onDelete(id); };
  const editingMovie = movies.find(x => x.id === editingId) || null;
  const closeProgress = Math.min(1, pull / 220);
  const cardRadius = closing ? 30 : Math.round(closeProgress * 26);
  const cardScale = closing ? 0.9 : 1 - closeProgress * 0.075;
  const cardShadow = pull>4 || closing ? `0 ${18+closeProgress*20}px ${50+closeProgress*40}px rgba(0,0,0,${0.25+closeProgress*0.25})` : "none";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"var(--bg)" }}>
      <div className="reel-detail-enter" style={{ position:"absolute", inset:0, overflow:"hidden", background:"var(--bg)",
        borderRadius: cardRadius, boxShadow: cardShadow,
        transform: closing ? "translateY(100%) scale(.9)" : `translateY(${pull}px) scale(${cardScale})`,
        transformOrigin:"50% 0%",
        opacity: closing ? 0 : 1,
        transition: closing ? "transform .26s cubic-bezier(.32,.72,.35,1), opacity .26s ease, border-radius .26s ease"
          : bouncing ? "transform .38s cubic-bezier(.34,1.56,.64,1), border-radius .38s ease, box-shadow .38s ease"
          : pulling ? "none" : "transform .22s ease, border-radius .22s ease, box-shadow .22s ease" }}
        onTransitionEnd={()=>setBouncing(false)}>
        <button className="reel-tap" onClick={requestClose} aria-label="もどる"
          style={{ position:"absolute", top:"calc(env(safe-area-inset-top, 0px) + 12px)", left:12, zIndex:5, width:36, height:36, borderRadius:"50%", border:"none", background:"rgba(12,13,22,.55)", color:"#fff", fontSize:19, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(2px)" }}>‹</button>
        <div ref={feedRef} className="reel-feed" style={{ height:"100%", overflowY:"auto", scrollSnapType:"y mandatory", WebkitOverflowScrolling:"touch", touchAction:"pan-y" }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {movies.map(m => <PostCard key={m.id} m={m} readOnly={readOnly} onShare={onShare} onDelete={del} onEdit={()=>setEditingId(m.id)} />)}
        </div>
      </div>
      {editingMovie && <EditSheet movie={editingMovie} onClose={()=>setEditingId(null)} onSave={onUpdate} />}
    </div>
  );
}

const RECAP_MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
function RecapView({ movies, user, onClose, year, month }) {
  const now = new Date();
  const ty = year ?? now.getFullYear();
  const tm = month ?? now.getMonth();
  const list = movies.filter(m => { const d = new Date(m.watchedAt); return d.getMonth()===tm && d.getFullYear()===ty; });
  const tiles = list.slice(0, 5);
  const extra = list.length - tiles.length;
  const share = async () => { try { if (navigator.share) await navigator.share({ title:"シネたび", text:`${tm+1}月は ${list.length}本 観ました🎬 #シネたび` }); } catch {} };

  const startRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const onTouchStart = (e) => { startRef.current = e.touches[0].clientY; setDragging(true); };
  const onTouchMove = (e) => {
    if (startRef.current == null) return;
    const dy = e.touches[0].clientY - startRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => { if (dragY > 100) { onClose(); return; } setDragY(0); setDragging(false); startRef.current = null; };

  return (
    <div className="reel-detail-enter" style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(4,5,10,.82)", overflowY:"auto", padding:"calc(env(safe-area-inset-top, 0px) + 20px) 0 20px" }} onClick={onClose}>
      <div className="reel-sheet" onClick={e=>e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ padding:"0 16px", transform:`translateY(${dragY}px)`, opacity: 1 - Math.min(1,dragY/300)*0.6, transition: dragging && dragY>0 ? "none" : "transform .25s ease, opacity .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
          <div style={{ width:36, height:4, borderRadius:4, background:"rgba(255,255,255,.25)" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <button className="reel-tap" onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:14, cursor:"pointer" }}>✕ 閉じる</button>
        </div>
        <div style={{ border:"1px solid var(--line)", borderRadius:18, overflow:"hidden", background:"linear-gradient(180deg, rgba(232,176,75,.12), transparent 42%), var(--surface)" }}>
          <div style={{ padding:"18px 18px 10px" }}>
            <div className="reel-mark" style={{ letterSpacing:".2em", fontSize:11, color:"var(--amber)" }}>{RECAP_MONTHS[tm]} {ty}</div>
            <div style={{ fontWeight:900, fontSize:22 }}>{tm+1}月は {list.length}本 観ました🎬</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gridAutoRows:"92px", gap:4, padding:"10px 14px" }}>
            {tiles.map((m, idx) => (
              <div key={m.id} style={{ gridRow: idx===0 ? "span 2" : "auto", borderRadius:10, overflow:"hidden", background:"var(--surface2)" }}>
                {m.image
                  ? <img src={m.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                  : <Poster film={{ title:m.title, posterPath:m.posterPath || null, year:m.year }} style={{ width:"100%", height:"100%", borderRadius:0 }} />}
              </div>
            ))}
            {extra>0 && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", borderRadius:10, color:"var(--amber)", fontWeight:900, fontSize:15 }}>+{extra}</div>}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px 16px" }}>
            <span style={{ fontWeight:700, fontSize:13 }}>{user?.name || ""}</span>
            <span className="reel-mark" style={{ fontSize:10, letterSpacing:".18em", color:"var(--amber)" }}>CINETABI</span>
          </div>
        </div>
        <p style={{ textAlign:"center", color:"var(--ink-dim)", fontSize:12, margin:"12px 0 0", lineHeight:1.7 }}>この画面をスクショしてストーリーズに貼れます</p>
        {typeof navigator !== "undefined" && navigator.share && (
          <button className="reel-btn" onClick={share} style={{ width:"100%", marginTop:12, padding:"13px", borderRadius:11, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>シェアする</button>
        )}
      </div>
    </div>
  );
}

function LogView({ movies, user, onAdd, onDelete, onShare, onUpdate }) {
  const [thumb, setThumb] = useState("poster"); // "poster" | "photo"
  const [detail, setDetail] = useState(null);    // index or null
  const [recap, setRecap] = useState(null);       // {year, month} or null
  const hasAnyPhoto = movies.some(m => m.image);

  if (movies.length === 0) {
    return (
      <div style={{ padding:"60px 28px", textAlign:"center" }}>
        <div style={{ fontSize:40, fontWeight:900, color:"var(--surface2)", lineHeight:1, letterSpacing:".04em" }}>シネたび</div>
        <p style={{ color:"var(--ink-dim)", marginTop:18, lineHeight:1.7 }}>まだ記録がありません。<br/>観た映画を検索して、書き残してみましょう。</p>
        <button className="reel-btn" onClick={onAdd} style={{ marginTop:22, padding:"13px 26px", borderRadius:12, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, cursor:"pointer" }}>映画を検索して記録</button>
      </div>
    );
  }

  const now = new Date();
  const yearCount = movies.filter(m => new Date(m.watchedAt).getFullYear() === now.getFullYear()).length;

  // 各記録に「コマ番号（01A…）」を月ごとに割り当て（同月内で古い順に採番）
  const mkey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
  const groups = {};
  movies.forEach((m, i) => { (groups[mkey(new Date(m.watchedAt))] ||= []).push(i); });
  const codeOf = {};
  const countOf = {};
  Object.values(groups).forEach(idxs => {
    const sorted = [...idxs].sort((a,b)=> new Date(movies[a].watchedAt) - new Date(movies[b].watchedAt));
    sorted.forEach((idx,n)=> { codeOf[idx] = frameCode(n); });
    idxs.forEach(idx => { countOf[idx] = idxs.length; });
  });

  // 表示リスト（新しい順のまま）を走査し、月が変わる位置に「継ぎ目（英語月名）」を差し込む
  const rows = [];
  let prevKey = null;
  movies.forEach((m, i) => {
    const d = new Date(m.watchedAt);
    const k = mkey(d);
    if (k !== prevKey) {
      rows.push({ type:"seam", key:"seam-"+k, year:d.getFullYear(), month:d.getMonth(), count:countOf[i] });
      prevKey = k;
    }
    rows.push({ type:"frame", key:m.id, m, code:codeOf[i], index:i });
  });

  return (
    <div style={{ padding:"0 0 110px" }}>
      <div className="reel-narrow" style={{ padding:"12px 14px 8px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #17130b" }}>
        <span className="mono" style={{ fontSize:11, color:"var(--ink-dim)", letterSpacing:".06em" }}>{now.getFullYear()} — {yearCount} FILMS</span>
        {hasAnyPhoto && (
          <div style={{ display:"flex", border:"1px solid var(--line)", borderRadius:8, overflow:"hidden" }}>
            {[["poster","POSTER"],["photo","MEM"]].map(([v,t]) => (
              <button key={v} className="reel-tap mono" onClick={()=>setThumb(v)} style={{ padding:"5px 11px", border:"none", cursor:"pointer", fontSize:10.5, fontWeight:700, letterSpacing:".08em", background: thumb===v?"var(--amber)":"transparent", color: thumb===v?"#1a1305":"var(--ink-dim)" }}>{t}</button>
            ))}
          </div>
        )}
      </div>

      <div className="reel-narrow film-body">
        <div className="film-spro" />
        <div className="film-track">
          {rows.map(r => r.type === "seam" ? (
            <button key={r.key} className="reel-tap film-frame" onClick={()=>setRecap({ year:r.year, month:r.month })}
              style={{ background:"#0a0a09", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"none" }}>
              <span className="mono" style={{ fontWeight:700, fontSize:26, letterSpacing:".28em", textIndent:".28em", color:"var(--amber)" }}>{RECAP_MONTHS[r.month]}</span>
              <span className="mem">{r.count} EXP</span>
            </button>
          ) : (
            <FilmFrame key={r.key} m={r.m} showPhoto={thumb==="photo"} code={r.code} onClick={()=>withViewTransition(()=>setDetail(r.index))} style={{ cursor:"pointer" }} />
          ))}
        </div>
        <div className="film-spro" />
      </div>
      <div className="reel-narrow mono" style={{ textAlign:"center", color:"#6f6a58", fontSize:10, padding:"10px 0 0", letterSpacing:".1em" }}>SLIDE ▼</div>

      {detail !== null && <DetailView movies={movies} index={detail} onClose={()=>withViewTransition(()=>setDetail(null))} onShare={onShare} onDelete={onDelete} onUpdate={onUpdate} />}
      {recap && <RecapView movies={movies} user={user} year={recap.year} month={recap.month} onClose={()=>setRecap(null)} />}
    </div>
  );
}

/* ─────────── でかける（近くの映画館） ─────────── */
function FindView() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { label, cinemas } | { error } | null
  const walkOptions = [5, 10, 15];

  const run = async (params) => {
    setLoading(true); setData(null);
    try {
      const r = await fetch(`/api/cinemas?${params}`);
      setData(await r.json());
    } catch { setData({ error: "failed" }); }
    setLoading(false);
  };
  const searchByText = () => { const q = query.trim(); if (q) run(`q=${encodeURIComponent(q)}`); };
  const searchByGPS = () => {
    if (!navigator.geolocation) { alert("この端末では現在地を取得できません。場所を入力して検索してください。"); return; }
    setLoading(true); setData(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => run(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
      () => { setLoading(false); alert("現在地を取得できませんでした。場所を入力して検索してください。"); }
    );
  };

  const cinemas = (data && data.cinemas) || [];
  const within = cinemas.filter(c => c.walk <= limit);
  const show = within.length ? within : cinemas.slice(0, 1);
  const onlyNearest = cinemas.length > 0 && within.length === 0;

  return (
    <div className="reel-narrow" style={{ padding:"4px 16px 110px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"16px 16px 18px", marginBottom:18 }}>
        <div className="reel-mark" style={{ letterSpacing:".16em", fontSize:11, color:"var(--ink-dim)", marginBottom:14 }}>CINEMAS ／ 近くの映画館</div>

        <label style={lbl}>場所（駅名・地名）</label>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") searchByText(); }}
            placeholder="例：渋谷駅、吉祥寺、横浜" style={{ ...inp, marginBottom:0, flex:1 }} />
          <button className="reel-btn" onClick={searchByText} style={{ flexShrink:0, padding:"0 18px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>さがす</button>
        </div>
        <button className="reel-tap" onClick={searchByGPS} style={{ width:"100%", marginBottom:18, padding:"11px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink)", fontSize:14, cursor:"pointer" }}>📍 現在地から探す</button>

        <label style={lbl}>徒歩での所要時間（目安）</label>
        <div style={{ display:"flex", gap:8 }}>
          {walkOptions.map(n => <button key={n} className="reel-tap" onClick={()=>setLimit(n)} style={{ ...chip(n===limit), flex:1, padding:"11px" }}>{n}<span style={{ fontSize:11, marginLeft:2 }}>分以内</span></button>)}
        </div>
      </div>

      {loading && <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"30px 10px" }}>さがしています…</p>}

      {!loading && data && (
        data.error === "not_found" ? (
          <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"30px 10px", lineHeight:1.7 }}>その場所が見つかりませんでした。<br/>「渋谷駅」「吉祥寺」のように入力してみてください。</p>
        ) : data.error ? (
          <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"30px 10px", lineHeight:1.7 }}>うまく取得できませんでした。<br/>少し時間をおいて、もう一度お試しください。</p>
        ) : cinemas.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"30px 10px", lineHeight:1.7 }}>近くに映画館が見つかりませんでした。<br/>別の場所で試してみてください。</p>
        ) : (
          <>
            <div className="reel-mark" style={{ letterSpacing:".14em", fontSize:11, color:"var(--ink-dim)", margin:"4px 4px 12px" }}>
              {data.label} ／ {onlyNearest ? "一番近い映画館" : `徒歩${limit}分以内 ${show.length}館`}
            </div>
            {onlyNearest && <p style={{ color:"var(--ink-dim)", fontSize:12.5, margin:"0 4px 12px", lineHeight:1.6 }}>徒歩{limit}分以内には見つからなかったので、一番近い映画館を表示しています。</p>}
            <div className="reel-grid">
            {show.map((c, i) => (
              <article key={c.id} className="fade-up" style={{ background:"var(--surface)", border:"1px solid var(--line)", borderRadius:14, padding:"14px 16px", animationDelay:`${Math.min(i*45,270)}ms` }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:700, lineHeight:1.3 }}>{c.name}</h3>
                <div style={{ margin:"5px 0 0", fontSize:13, color:"var(--amber-dim)" }}>
                  約 徒歩{c.walk}分（約{c.dist >= 1000 ? (c.dist/1000).toFixed(1)+"km" : c.dist+"m"}）
                  {c.isApprox && <span style={{ marginLeft:6, fontSize:11, color:"var(--ink-dim)" }}>・おおよその位置</span>}
                </div>
              </article>
            ))}
            </div>
            <p style={{ textAlign:"center", color:"var(--line)", fontSize:11, marginTop:14, lineHeight:1.6 }}>映画館データ：OpenStreetMap／「消えた映画館の記憶」(hekikaicinema.memo.wiki) ／ 徒歩分は道のりからの概算です</p>
          </>
        )
      )}
    </div>
  );
}

/* ─────────── メインの画面（記録/でかける）。データ源に依存しない共通シェル ─────────── */
function Shell({ user, movies, loading, onAddMovie, onDeleteMovie, onUpdateMovie, onLogout, isAnonymous, followInfo, followLink, onFollowLinkDone }) {
  const [view, setView] = useState("log");
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const deleteMovie = async (id) => { if (confirm("この記録を削除しますか？")) await onDeleteMovie(id); };

  return (
    <div className="reel-root">
      <style>{STYLES}</style>
      <header style={{ position:"sticky", top:0, zIndex:20, background:"linear-gradient(180deg, rgba(232,176,75,.10), rgba(12,13,22,0) 70%), var(--bg)", borderBottom:"1px solid var(--line)", padding:"calc(env(safe-area-inset-top, 0px) + 16px) 18px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <Wordmark />
          {user && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {onLogout && <button className="reel-tap" onClick={onLogout} style={{ background:"none", border:"none", color:"var(--ink-dim)", fontSize:12, cursor:"pointer" }}>ログアウト</button>}
              <span style={{ fontSize:13, color:"var(--ink-dim)" }}>{user.name}</span>
              <span style={{ width:30, height:30, borderRadius:"50%", background:"var(--amber)", color:"#1a1305", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14 }}>{[...user.name][0] || "?"}</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:24, marginTop:10 }}>
          {[["log","記録"],["find","でかける"], ...(followInfo ? [["follow","フォロー"]] : [])].map(([v,t]) => (
            <button key={v} className="reel-tap" onClick={()=>setView(v)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0", fontSize:15, fontWeight:700, color: view===v?"var(--ink)":"var(--ink-dim)", borderBottom: view===v?"2px solid var(--amber)":"2px solid transparent" }}>{t}</button>
          ))}
        </div>
      </header>

      {isAnonymous && (
        <div className="reel-narrow" style={{ padding:"10px 16px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(232,176,75,.08)", border:"1px solid var(--amber-dim)", borderRadius:12, padding:"10px 13px" }}>
            <span style={{ fontSize:12.5, color:"var(--ink-dim)", lineHeight:1.6, flex:1 }}>いまは匿名（この端末だけ）です。別の端末でも使う・バックアップするには</span>
            <button className="reel-tap" onClick={()=>setConnecting(true)} style={{ flexShrink:0, padding:"7px 12px", borderRadius:9, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:12.5, cursor:"pointer" }}>つなぐ</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"60px" }}>読み込み中…</p>
        : view === "log" ? <LogView movies={movies} user={user} onAdd={()=>setAdding(true)} onDelete={deleteMovie} onShare={setSharing} onUpdate={onUpdateMovie} />
        : view === "find" ? <FindView />
        : isAnonymous ? <FollowLockedNotice onConnect={()=>setConnecting(true)} />
        : <FollowView me={followInfo} />}

      {view === "log" && !loading && movies.length > 0 && (
        <button className="reel-btn reel-fab" onClick={()=>setAdding(true)} aria-label="記録を追加"
          style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", maxWidth:520, width:"calc(100% - 32px)", padding:"15px", borderRadius:14, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:"0 8px 30px rgba(232,176,75,.25)" }}>＋ 映画を記録</button>
      )}

      {adding && <AddSheet onClose={()=>setAdding(false)} onSave={onAddMovie} existingIds={movies.map(m=>m.filmId).filter(Boolean)} />}
      {sharing && <ShareSheet movie={sharing} user={user} onClose={()=>setSharing(null)} />}
      {connecting && <ConnectSheet onClose={()=>setConnecting(false)} />}
      {followLink && followInfo && (
        <LinkConfirmSheet payload={followLink} isAnonymous={isAnonymous}
          onClose={()=>onFollowLinkDone(true)}
          onConnect={()=>{ onFollowLinkDone(false); setConnecting(true); }} />
      )}
    </div>
  );
}

/* ─────────── 端末保存モード（Supabase未設定時のフォールバック・従来どおり） ─────────── */
function LocalApp() {
  const [user, setUser] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    setUser(store.get("cinetabi_user"));
    setMovies(store.get("cinetabi_movies") || []);
    setOnboarded(!!store.get("cinetabi_onboarded"));
    setLoading(false);
  }, []);

  const persist = (list) => {
    setMovies(list);
    if (!store.set("cinetabi_movies", list)) alert("保存に失敗しました。端末の保存容量がいっぱいの可能性があります（写真が多すぎるなど）。");
  };
  const addMovie = (m) => persist([m, ...movies]);
  const deleteMovie = (id) => persist(movies.filter(x => x.id !== id));
  const updateMovie = (m) => persist(movies.map(x => x.id === m.id ? m : x));
  const registerUser = (u) => { setUser(u); setOnboarded(false); store.set("cinetabi_user", u); };
  const finishOnboarding = (records) => {
    setOnboarded(true); store.set("cinetabi_onboarded", true);
    if (records.length) persist([...records, ...movies]);
  };

  if (!loading && !user) return <Gate><Registration onRegister={registerUser} /></Gate>;
  if (!loading && !onboarded && movies.length === 0) return <Gate><Onboarding onDone={finishOnboarding} /></Gate>;
  return <Shell user={user} movies={movies} loading={loading} onAddMovie={addMovie} onDeleteMovie={deleteMovie} onUpdateMovie={updateMovie} />;
}

/* ─────────── クラウドモード（Supabase：メールログイン＋クラウド保存） ─────────── */
const toApp = (r) => ({ id:r.id, filmId:r.tmdb_id, title:r.title, year:r.year, posterPath:r.poster_path, genres:r.genres || [], note:r.note || "", image:r.image || null, watchedAt:r.watched_at });
const toRow = (m, uid) => ({ user_id:uid, tmdb_id:m.filmId, title:m.title, year:m.year || null, poster_path:m.posterPath || null, genres:m.genres || [], note:m.note || "", image:m.image || null, watched_at:m.watchedAt });

function Gate({ children }) {
  return (
    <div className="reel-root">
      <style>{STYLES}</style>
      <header style={{ padding:"calc(env(safe-area-inset-top, 0px) + 16px) 18px 12px", borderBottom:"1px solid var(--line)" }}><Wordmark /></header>
      {children}
    </div>
  );
}

function Welcome() {
  const [mode, setMode] = useState("home"); // home | login
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const startAnon = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (error) alert("開始に失敗しました：" + error.message);
  };
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) alert("Googleログインに失敗しました：" + error.message);
  };
  const sendEmail = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) alert("送信に失敗しました：" + error.message); else setSent(true);
  };

  return (
    <Gate>
      <div style={{ padding:"40px 24px" }}>
        {mode === "home" ? (
          <>
            <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>WELCOME</div>
            <h2 style={{ margin:"8px 0 6px", fontSize:22, lineHeight:1.4 }}>シネたびへようこそ</h2>
            <p style={{ margin:"0 0 26px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.8 }}>登録なしですぐ始められます。あとから「アカウントをつなぐ」と、別の端末でも使えてデータも守られます。</p>
            <button className="reel-btn" disabled={busy} onClick={startAnon}
              style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background:"var(--amber)", color:"#1a1305", marginBottom:14 }}>
              {busy ? "準備中…" : "このまま はじめる"}
            </button>
            <button className="reel-tap" onClick={()=>setMode("login")} style={{ width:"100%", background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer", padding:"6px" }}>
              すでにアカウントがある方はこちら →
            </button>
          </>
        ) : sent ? (
          <>
            <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>LOGIN</div>
            <h2 style={{ margin:"8px 0 6px", fontSize:22, lineHeight:1.4 }}>メールを確認してください</h2>
            <p style={{ margin:"0 0 22px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.8 }}>{email} 宛にログイン用のリンクを送りました。メール内のリンクを押すと、ここに戻ってログインが完了します。<br/><br/>※ 届かない時は迷惑メールフォルダもご確認ください。</p>
            <button className="reel-tap" onClick={()=>setSent(false)} style={{ background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer", padding:0 }}>← 入れ直す</button>
          </>
        ) : (
          <>
            <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>LOGIN</div>
            <h2 style={{ margin:"8px 0 16px", fontSize:22, lineHeight:1.4 }}>ログイン / 引き継ぐ</h2>
            <button className="reel-tap" onClick={google} style={{ width:"100%", padding:"13px", borderRadius:12, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink)", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:18 }}>Googleでログイン</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 18px", color:"var(--ink-dim)", fontSize:12 }}><span style={{ flex:1, height:1, background:"var(--line)" }} />または<span style={{ flex:1, height:1, background:"var(--line)" }} /></div>
            <label style={lbl}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") sendEmail(); }} placeholder="you@example.com" style={inp} />
            <button className="reel-btn" disabled={!email.trim()||busy} onClick={sendEmail}
              style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background: email.trim()&&!busy?"var(--amber)":"var(--surface2)", color: email.trim()&&!busy?"#1a1305":"var(--ink-dim)", marginBottom:14 }}>
              {busy ? "送信中…" : "メールでログインリンクを送る"}
            </button>
            <button className="reel-tap" onClick={()=>setMode("home")} style={{ width:"100%", background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer", padding:"6px" }}>← もどる</button>
          </>
        )}
      </div>
    </Gate>
  );
}

function ConnectSheet({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) alert("Google連携に失敗しました：" + error.message);
  };
  const linkEmail = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(false);
    if (error) alert("メール連携に失敗しました：" + error.message); else setSent(true);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={onClose}>
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", touchAction:"pan-y", overscrollBehaviorX:"none", padding:"8px 20px 28px" }}>
        <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:14 }}>CONNECT ／ アカウントをつなぐ</div>
        {sent ? (
          <p style={{ color:"var(--ink-dim)", fontSize:14, lineHeight:1.8, padding:"10px 0 6px" }}>{email} に確認メールを送りました。リンクを押すと連携が完了し、別の端末でもこのメールでログインできるようになります。<br/><br/>※ 届かない時は迷惑メールもご確認ください。</p>
        ) : (
          <>
            <p style={{ margin:"0 0 20px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.8 }}>つなぐと、別の端末でも同じ記録が使え、データのバックアップにもなります。メールアドレスは他のユーザーには公開されません。</p>
            <button className="reel-tap" onClick={google} style={{ width:"100%", padding:"13px", borderRadius:12, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink)", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:18 }}>Googleでつなぐ</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 18px", color:"var(--ink-dim)", fontSize:12 }}><span style={{ flex:1, height:1, background:"var(--line)" }} />または<span style={{ flex:1, height:1, background:"var(--line)" }} /></div>
            <label style={lbl}>メールでつなぐ</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
            <button className="reel-btn" disabled={!email.trim()||busy} onClick={linkEmail}
              style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background: email.trim()&&!busy?"var(--amber)":"var(--surface2)", color: email.trim()&&!busy?"#1a1305":"var(--ink-dim)" }}>
              {busy ? "送信中…" : "確認メールを送る"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}


/* ─────────── フォロー機能（クラウドモード専用） ───────────
   ・全員が鍵垢：記録はデフォルト非公開。承認された相手だけが読める
   ・申請は「相手のID＋名前の両方一致」が必要（RPCでサーバー側チェック）
   ・拒否＝行の削除（相手に通知は出ず、申請中の表示が消えるだけ）      */

// RPCの結果コード → 表示文言
const FOLLOW_ERR = {
  not_found: "IDと名前の組み合わせが見つかりませんでした。相手に教えてもらったとおり、正確に入力してください。",
  self: "自分自身はフォローできません。",
  already_requested: "すでに申請ずみです。相手の承認をお待ちください。",
  already_following: "すでにフォローしています。",
  not_signed_in: "ログイン状態を確認できませんでした。アプリを開き直してもう一度お試しください。",
  anonymous: "フォロー機能は、アカウントをつないでから使えます。",
};

// フォロー申請（ID＋名前の一致チェックはサーバー側のRPCが強制する）
async function requestFollow(publicId, name) {
  try {
    const { data, error } = await supabase.rpc("request_follow", { target_public_id: publicId.trim(), target_name: name.trim() });
    if (error || !data) return { ok:false, code:"rpc_error" };
    return data;
  } catch { return { ok:false, code:"rpc_error" }; }
}

// 招待リンク（/#f=…）。開いた相手には申請の確認画面が出る
function inviteLink(me) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try { return origin + "/#f=" + btoa(unescape(encodeURIComponent(JSON.stringify({ i: me.publicId, n: me.name })))); }
  catch { return origin; }
}

/* ── フォローを申請（ID＋名前の入力フォーム） ── */
function FollowRequestSheet({ onClose }) {
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const canSend = pid.trim() !== "" && name.trim() !== "" && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true); setErr("");
    const r = await requestFollow(pid, name);
    setBusy(false);
    if (r.ok) setDone(true);
    else setErr(FOLLOW_ERR[r.code] || "送信に失敗しました。時間をおいてもう一度お試しください。");
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={onClose}>
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", touchAction:"pan-y", overscrollBehaviorX:"none", padding:"8px 20px 28px" }}>
        <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:14 }}>FOLLOW ／ フォローを申請</div>
        {done ? (
          <>
            <p style={{ margin:"0 0 20px", color:"var(--ink)", fontSize:14.5, lineHeight:1.8 }}>申請を送りました。<br/>相手が承認すると、その人の記録を見られるようになります。</p>
            <button className="reel-btn" onClick={onClose} style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:15, cursor:"pointer" }}>閉じる</button>
          </>
        ) : (
          <>
            <p style={{ margin:"0 0 18px", color:"var(--ink-dim)", fontSize:13, lineHeight:1.8 }}>このアプリにユーザー検索はありません。相手から教えてもらった「ID」と「名前」の<b style={{ color:"var(--ink)" }}>両方が一致した時だけ</b>、申請が届きます。</p>
            <label style={lbl}>相手のID</label>
            <input value={pid} onChange={e=>setPid(e.target.value)} placeholder="usr_xxxxxxxxxxxx" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              style={{ ...inp, fontFamily:"'Space Mono',ui-monospace,monospace" }} />
            <label style={lbl}>相手の名前（表示名）</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="例：たろう" maxLength={24} style={inp} />
            {err && <p style={{ margin:"0 0 14px", color:"var(--rose)", fontSize:13, lineHeight:1.7 }}>{err}</p>}
            <button className="reel-btn" disabled={!canSend} onClick={send}
              style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700,
                background: canSend?"var(--amber)":"var(--surface2)", color: canSend?"#1a1305":"var(--ink-dim)" }}>
              {busy ? "送信中…" : "申請を送る"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 匿名ユーザー向け：フォロー機能はアカウント連携後に使える ── */
function FollowLockedNotice({ onConnect }) {
  return (
    <div className="reel-narrow" style={{ padding:"4px 16px 110px" }}>
      <div style={{ textAlign:"center", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"44px 24px" }}>
        <div style={{ fontSize:30, marginBottom:12 }}>🔗</div>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:10 }}>フォロー機能は「つないだ後」に使えます</div>
        <p style={{ margin:"0 0 22px", color:"var(--ink-dim)", fontSize:13.5, lineHeight:1.8 }}>いまは匿名（この端末だけ）の状態です。<br/>メールまたはGoogleでアカウントをつなぐと、<br/>フォローの申請・承認ができるようになります。</p>
        <button className="reel-btn" onClick={onConnect} style={{ padding:"13px 28px", borderRadius:12, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>アカウントをつなぐ</button>
      </div>
    </div>
  );
}

/* ── 招待リンクを開いた時の確認画面 ── */
function LinkConfirmSheet({ payload, onClose, isAnonymous, onConnect }) {
  const [phase, setPhase] = useState("confirm"); // confirm | busy | done | error
  const [err, setErr] = useState("");
  const send = async () => {
    setPhase("busy");
    const r = await requestFollow(payload.i, payload.n);
    if (r.ok) setPhase("done");
    else { setErr(FOLLOW_ERR[r.code] || "送信に失敗しました。時間をおいてもう一度お試しください。"); setPhase("error"); }
  };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,5,10,.7)", padding:24 }} onClick={phase==="busy"?undefined:onClose}>
      <div className="fade-up" onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:360, background:"var(--bg2)", border:"1px solid var(--line)", borderRadius:16, padding:"22px 20px" }}>
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:11, color:"var(--amber)", marginBottom:12 }}>FOLLOW REQUEST ／ リンクから申請</div>
        {isAnonymous ? (
          <>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>「{payload.n}」さんへのフォロー申請</div>
            <p style={{ margin:"0 0 20px", color:"var(--ink-dim)", fontSize:13, lineHeight:1.8 }}>フォロー機能は、アカウントをつないでから使えます。<br/>つないだ後に、もう一度この確認が表示されます。</p>
            <button className="reel-btn" onClick={onConnect} style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:8 }}>アカウントをつなぐ</button>
            <button className="reel-tap" onClick={onClose} style={{ width:"100%", padding:"13px", borderRadius:10, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>あとで</button>
          </>
        ) : phase === "done" ? (
          <>
            <p style={{ margin:"0 0 20px", fontSize:14.5, lineHeight:1.8 }}>「{payload.n}」さんに申請を送りました。<br/>承認されると記録を見られるようになります。</p>
            <button className="reel-btn" onClick={onClose} style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>閉じる</button>
          </>
        ) : phase === "error" ? (
          <>
            <p style={{ margin:"0 0 20px", color:"var(--rose)", fontSize:13.5, lineHeight:1.8 }}>{err}</p>
            <button className="reel-tap" onClick={onClose} style={{ width:"100%", padding:"13px", borderRadius:10, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>閉じる</button>
          </>
        ) : (
          <>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>「{payload.n}」さんをフォローしますか？</div>
            <div className="mono" style={{ fontSize:12.5, color:"var(--ink-dim)", marginBottom:12 }}>{payload.i}</div>
            <p style={{ margin:"0 0 20px", color:"var(--ink-dim)", fontSize:13, lineHeight:1.7 }}>相手が承認するまで、記録は見られません。</p>
            <button className="reel-btn" disabled={phase==="busy"} onClick={send} style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:8 }}>
              {phase==="busy" ? "送信中…" : "フォローを申請する"}
            </button>
            <button className="reel-tap" onClick={onClose} style={{ width:"100%", padding:"13px", borderRadius:10, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>やめる</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── フォロー相手の画面：承認待ちなら非公開表示、承認後は記録を閲覧 ── */
function FriendView({ row, profile, onClose, onRemove }) {
  const accepted = row.status === "accepted";
  const [recs, setRecs] = useState(null); // null=読み込み中
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!accepted) { setRecs([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.from("records").select("*").eq("user_id", row.followee_id).order("watched_at", { ascending:false });
      if (alive) setRecs((data || []).map(toApp));
    })();
    return () => { alive = false; };
  }, []);

  const name = profile?.display_name || "（名前を取得できません）";
  const remove = () => {
    if (confirm(accepted ? `${name} さんのフォローをやめますか？` : "この申請を取り下げますか？")) onRemove(row.id);
  };

  return (
    <div className="reel-detail-enter" style={{ position:"fixed", inset:0, zIndex:65, background:"var(--bg)", overflowY:"auto" }}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"calc(env(safe-area-inset-top, 0px) + 14px) 16px 40px" }}>
        <button className="reel-tap" onClick={onClose} style={{ background:"none", border:"none", color:"var(--ink-dim)", fontSize:14, cursor:"pointer", padding:"6px 0", marginBottom:8 }}>‹ もどる</button>

        <div style={{ display:"flex", alignItems:"center", gap:12, background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"16px", marginBottom:16 }}>
          <span style={{ width:44, height:44, borderRadius:"50%", background:"var(--amber)", color:"#1a1305", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:19, flexShrink:0 }}>{[...name][0] || "?"}</span>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontWeight:900, fontSize:17 }}>{name}</div>
            {profile?.public_id && <div className="mono" style={{ fontSize:11.5, color:"var(--ink-dim)" }}>{profile.public_id}</div>}
          </div>
          <span style={{ flexShrink:0, fontSize:11.5, fontWeight:700, borderRadius:20, padding:"4px 10px",
            background: accepted?"rgba(232,176,75,.14)":"var(--surface2)", color: accepted?"var(--amber)":"var(--ink-dim)", border:`1px solid ${accepted?"var(--amber-dim)":"var(--line)"}` }}>
            {accepted ? "フォロー中" : "承認待ち"}
          </span>
        </div>

        {!accepted ? (
          <div style={{ textAlign:"center", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"38px 20px" }}>
            <div style={{ fontSize:30, marginBottom:10 }}>🔒</div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>このユーザーの記録は非公開です</div>
            <p style={{ margin:0, color:"var(--ink-dim)", fontSize:13, lineHeight:1.8 }}>{name} さんが申請を承認すると、<br/>ここに記録が表示されます。</p>
          </div>
        ) : recs === null ? (
          <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"40px 0" }}>読み込み中…</p>
        ) : recs.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"40px 0", lineHeight:1.8 }}>まだ記録がありません。</p>
        ) : (
          <div className="film-body" style={{ borderRadius:12, overflow:"hidden" }}>
            <div className="film-spro" />
            <div className="film-track">
              {recs.map((m, i) => <FilmFrame key={m.id} m={m} showPhoto={false} code={frameCode(i)} onClick={()=>setDetail(i)} style={{ cursor:"pointer" }} />)}
            </div>
            <div className="film-spro" />
          </div>
        )}

        <button className="reel-tap" onClick={remove} style={{ width:"100%", marginTop:22, padding:"13px", borderRadius:11, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:13.5, cursor:"pointer" }}>
          {accepted ? "フォローをやめる" : "申請を取り下げる"}
        </button>
      </div>
      {detail !== null && recs && <DetailView movies={recs} index={detail} readOnly onClose={()=>setDetail(null)} />}
    </div>
  );
}

/* ── 「フォロー」タブ本体：自分のプロフィール・申請の承認/拒否・フォロー中一覧 ── */
function FollowView({ me }) {
  const [rows, setRows] = useState(null);     // follows の自分が当事者の行（null=読み込み中）
  const [people, setPeople] = useState({});   // 相手のプロフィール { uid: {display_name, public_id} }
  const [requesting, setRequesting] = useState(false);
  const [viewing, setViewing] = useState(null); // フォロー中一覧でタップした follows 行
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("follows").select("*")
      .or(`follower_id.eq.${me.uid},followee_id.eq.${me.uid}`)
      .order("created_at", { ascending:false });
    const fs = data || [];
    const ids = [...new Set(fs.map(r => r.follower_id === me.uid ? r.followee_id : r.follower_id))];
    const map = {};
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name, public_id").in("id", ids);
      (ps || []).forEach(p => { map[p.id] = p; });
    }
    setPeople(map); setRows(fs);
  };
  useEffect(() => { load(); }, []);

  const incoming = (rows || []).filter(r => r.followee_id === me.uid);
  const requestsIn = incoming.filter(r => r.status === "pending"); // とどいた申請
  const followers = incoming.filter(r => r.status === "accepted");  // フォロワー（数のみ表示）
  const outgoing = (rows || []).filter(r => r.follower_id === me.uid); // フォロー中＋申請中
  const followingCount = outgoing.filter(r => r.status === "accepted").length;

  const accept = async (id) => {
    const { error } = await supabase.from("follows").update({ status:"accepted" }).eq("id", id);
    if (error) { alert("承認に失敗しました：" + error.message); return; }
    load();
  };
  const reject = async (id) => {
    if (!confirm("この申請を削除しますか？（相手に通知はされません）")) return;
    const { error } = await supabase.from("follows").delete().eq("id", id);
    if (error) { alert("削除に失敗しました：" + error.message); return; }
    load();
  };
  const removeFollow = async (id) => {
    const { error } = await supabase.from("follows").delete().eq("id", id);
    if (error) { alert("解除に失敗しました：" + error.message); return; }
    setViewing(null); load();
  };

  const link = inviteLink(me);
  const copyLink = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false), 1600); } catch {} };
  const shareLink = async () => { try { if (navigator.share) await navigator.share({ title:"シネたび", text:`シネたびで「${me.name}」をフォローする`, url:link }); } catch {} };

  return (
    <div className="reel-narrow" style={{ padding:"4px 16px 110px" }}>
      {/* 自分のプロフィール */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"16px", marginBottom:14 }}>
        <div className="reel-mark" style={{ letterSpacing:".16em", fontSize:11, color:"var(--ink-dim)", marginBottom:12 }}>MY PROFILE ／ 自分のプロフィール</div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <span style={{ width:44, height:44, borderRadius:"50%", background:"var(--amber)", color:"#1a1305", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:19, flexShrink:0 }}>{[...me.name][0] || "?"}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:17 }}>{me.name}</div>
            <div style={{ fontSize:12.5, color:"var(--ink-dim)", marginTop:2 }}>フォロー中 {followingCount} ・ フォロワー {followers.length}<span style={{ fontSize:11, marginLeft:6, opacity:.8 }}>（あなたにだけ表示）</span></div>
          </div>
        </div>
        <label style={lbl}>あなたのID（相手に教えて、フォローしてもらう）</label>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <div className="mono" style={{ flex:1, minWidth:0, padding:"11px 13px", background:"var(--bg)", border:"1px solid var(--line)", borderRadius:10, fontSize:13.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{me.publicId}</div>
          <button className="reel-tap" onClick={async()=>{ try { await navigator.clipboard.writeText(me.publicId); setCopied(true); setTimeout(()=>setCopied(false),1600); } catch {} }}
            style={{ flexShrink:0, padding:"0 14px", borderRadius:10, border:"1px solid var(--line)", background: copied?"var(--amber)":"var(--surface2)", color: copied?"#1a1305":"var(--ink)", fontWeight:700, fontSize:13, cursor:"pointer" }}>{copied?"コピー済":"コピー"}</button>
        </div>
        <p style={{ margin:"0 0 12px", color:"var(--ink-dim)", fontSize:12, lineHeight:1.7 }}>フォローには「ID」と「名前（{me.name}）」の両方が必要です。IDだけでは申請できません。</p>
        <div style={{ display:"flex", gap:8 }}>
          <button className="reel-tap" onClick={copyLink} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface2)", color:"var(--ink)", fontSize:13, fontWeight:700, cursor:"pointer" }}>招待リンクをコピー</button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button className="reel-tap" onClick={shareLink} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface2)", color:"var(--ink)", fontSize:13, fontWeight:700, cursor:"pointer" }}>リンクを共有</button>
          )}
        </div>
      </div>

      {/* とどいた申請 */}
      {requestsIn.length > 0 && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--amber-dim)", borderRadius:16, padding:"16px", marginBottom:14 }}>
          <div className="reel-mark" style={{ letterSpacing:".16em", fontSize:11, color:"var(--amber)", marginBottom:12 }}>REQUESTS ／ とどいた申請</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {requestsIn.map(r => {
              const p = people[r.follower_id];
              return (
                <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p?.display_name || "（不明）"}</div>
                    {p?.public_id && <div className="mono" style={{ fontSize:11, color:"var(--ink-dim)" }}>{p.public_id}</div>}
                  </div>
                  <button className="reel-btn" onClick={()=>accept(r.id)} style={{ flexShrink:0, padding:"9px 16px", borderRadius:9, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:13, cursor:"pointer" }}>承認</button>
                  <button className="reel-tap" onClick={()=>reject(r.id)} style={{ flexShrink:0, padding:"9px 14px", borderRadius:9, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:13, cursor:"pointer" }}>拒否</button>
                </div>
              );
            })}
          </div>
          <p style={{ margin:"12px 0 0", color:"var(--ink-dim)", fontSize:11.5, lineHeight:1.7 }}>承認すると、相手はあなたの記録を見られるようになります。拒否は相手に通知されません。</p>
        </div>
      )}

      {/* フォロー中（申請中も含む） */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--line)", borderRadius:16, padding:"16px", marginBottom:18 }}>
        <div className="reel-mark" style={{ letterSpacing:".16em", fontSize:11, color:"var(--ink-dim)", marginBottom:12 }}>FOLLOWING ／ フォロー中</div>
        {rows === null ? (
          <p style={{ margin:0, textAlign:"center", color:"var(--ink-dim)", fontSize:13, padding:"14px 0" }}>読み込み中…</p>
        ) : outgoing.length === 0 ? (
          <p style={{ margin:0, color:"var(--ink-dim)", fontSize:13, lineHeight:1.8 }}>まだ誰もフォローしていません。<br/>下のボタンから、相手のIDと名前で申請できます。</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {outgoing.map(r => {
              const p = people[r.followee_id];
              const nm = p?.display_name || "（不明）";
              const pending = r.status === "pending";
              return (
                <button key={r.id} className="reel-tap" onClick={()=>setViewing(r)}
                  style={{ display:"flex", alignItems:"center", gap:11, textAlign:"left", background:"var(--surface2)", border:"1px solid var(--line)", borderRadius:12, padding:"11px 13px", cursor:"pointer" }}>
                  <span style={{ width:34, height:34, borderRadius:"50%", background: pending?"var(--surface)":"var(--amber)", color: pending?"var(--ink-dim)":"#1a1305", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:15, flexShrink:0, border: pending?"1px solid var(--line)":"none" }}>{[...nm][0] || "?"}</span>
                  <span style={{ flex:1, minWidth:0, fontWeight:700, fontSize:14.5, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nm}</span>
                  {pending
                    ? <span style={{ flexShrink:0, fontSize:11, color:"var(--ink-dim)", border:"1px solid var(--line)", borderRadius:20, padding:"3px 9px" }}>承認待ち</span>
                    : <span style={{ flexShrink:0, color:"var(--ink-dim)", fontSize:16 }}>›</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button className="reel-btn" onClick={()=>setRequesting(true)}
        style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:15, cursor:"pointer" }}>＋ フォローを申請</button>
      <p style={{ textAlign:"center", color:"var(--ink-dim)", fontSize:11.5, margin:"10px 0 0", lineHeight:1.7 }}>ユーザー検索はできません。相手からIDと名前を教えてもらって申請します。</p>

      {requesting && <FollowRequestSheet onClose={()=>{ setRequesting(false); load(); }} />}
      {viewing && <FriendView row={viewing} profile={people[viewing.followee_id]} onClose={()=>setViewing(null)} onRemove={removeFollow} />}
    </div>
  );
}

function NameSetup({ onDone }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => { if (!name.trim()) return; setBusy(true); await onDone(name.trim()); setBusy(false); };
  return (
    <Gate>
      <div style={{ padding:"40px 24px" }}>
        <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)" }}>CREATE PROFILE</div>
        <h2 style={{ margin:"8px 0 6px", fontSize:22, lineHeight:1.4 }}>お名前を教えてください</h2>
        <p style={{ margin:"0 0 22px", color:"var(--ink-dim)", fontSize:14, lineHeight:1.7 }}>表示名は記録に表示されます。あとから変更できます。</p>
        <label style={lbl}>名前（表示名）</label>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="例：たろう" style={inp} />
        <button className="reel-btn" disabled={!name.trim()||busy} onClick={submit}
          style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", cursor:"pointer", fontSize:15, fontWeight:700, background: name.trim()&&!busy?"var(--amber)":"var(--surface2)", color: name.trim()&&!busy?"#1a1305":"var(--ink-dim)" }}>
          {busy ? "作成中…" : "はじめる"}
        </button>
      </div>
    </Gate>
  );
}

function CloudApp() {
  const [session, setSession] = useState(undefined); // undefined=確認中, null=未ログイン
  const [profile, setProfile] = useState(undefined); // undefined=確認中, null=未作成
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  // 招待リンク（/#f=…）で開かれた場合、その中身を保持しておく。
  // Googleログイン等のリダイレクトでURLのハッシュが消えるため localStorage にも退避し、
  // 戻ってきた時に復元する（ログイン・プロフィール作成が済んでから確認画面を出す）
  const [followLink, setFollowLink] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.location.hash.startsWith("#f=")) {
        const d = JSON.parse(decodeURIComponent(escape(atob(window.location.hash.slice(3)))));
        if (d && d.i && d.n) { const v = { i: String(d.i), n: String(d.n) }; store.set("cinetabi_follow_link", v); return v; }
      }
    } catch {}
    const saved = store.get("cinetabi_follow_link");
    return (saved && saved.i && saved.n) ? saved : null;
  });
  // clear=false は「アカウントをつなぐ」へ進んだ時：確認画面は閉じるが退避は残し、
  // 連携が終わってアプリに戻ってきた時にもう一度確認を表示する
  const finishFollowLink = (clear) => {
    setFollowLink(null);
    if (clear) { try { localStorage.removeItem("cinetabi_follow_link"); } catch {} }
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) { setProfile(null); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(prof || null);
      if (prof) {
        // 自分の記録だけに絞る（フォロー機能のRLS拡張で、承認済みフォロー相手の記録も
        // 読める＝select("*")だけだと他人の記録が自分のログに混ざるため）
        const { data: recs } = await supabase.from("records").select("*").eq("user_id", session.user.id).order("watched_at", { ascending: false });
        setMovies((recs || []).map(toApp));
      }
      setLoading(false);
    })();
  }, [session]);

  const createProfile = async (name) => {
    const { data, error } = await supabase.from("profiles").insert({ id: session.user.id, display_name: name }).select().single();
    if (error) { alert("プロフィール作成に失敗しました：" + error.message); return; }
    setProfile(data);
  };
  const addMovie = async (m) => {
    const { data, error } = await supabase.from("records").insert(toRow(m, session.user.id)).select().single();
    if (error) { alert("保存に失敗しました：" + error.message); return; }
    setMovies(prev => [toApp(data), ...prev]);
  };
  const deleteMovie = async (id) => {
    const { error } = await supabase.from("records").delete().eq("id", id);
    if (error) { alert("削除に失敗しました：" + error.message); return; }
    setMovies(prev => prev.filter(x => x.id !== id));
  };
  const updateMovie = async (m) => {
    const { error } = await supabase.from("records").update({ note:m.note, image:m.image, watched_at:m.watchedAt }).eq("id", m.id);
    if (error) { alert("保存に失敗しました：" + error.message); return; }
    setMovies(prev => prev.map(x => x.id === m.id ? { ...x, note:m.note, image:m.image, watchedAt:m.watchedAt } : x));
  };
  const finishOnboarding = async (records) => {
    if (records.length) {
      const { data } = await supabase.from("records").insert(records.map(r => toRow(r, session.user.id))).select();
      setMovies(prev => [...(data || []).map(toApp), ...prev]);
    }
    await supabase.from("profiles").update({ onboarded: true }).eq("id", session.user.id);
    setProfile(p => ({ ...p, onboarded: true }));
  };
  const logout = async () => { if (confirm("ログアウトしますか？")) { await supabase.auth.signOut(); setProfile(undefined); setMovies([]); } };

  if (session === undefined || (session && profile === undefined)) {
    return <Gate><p style={{ textAlign:"center", color:"var(--ink-dim)", padding:"60px" }}>読み込み中…</p></Gate>;
  }
  if (session === null) return <Welcome />;
  if (profile === null) return <NameSetup onDone={createProfile} />;
  if (!loading && !profile.onboarded && movies.length === 0) return <Gate><Onboarding onDone={finishOnboarding} /></Gate>;

  const isAnonymous = !!session.user?.is_anonymous;
  return <Shell user={{ name: profile.display_name }} movies={movies} loading={loading} onAddMovie={addMovie} onDeleteMovie={deleteMovie} onUpdateMovie={updateMovie} onLogout={isAnonymous ? undefined : logout} isAnonymous={isAnonymous}
    followInfo={{ uid: session.user.id, name: profile.display_name, publicId: profile.public_id || "" }}
    followLink={followLink} onFollowLinkDone={finishFollowLink} />;
}

/* ─────────── ルート：Supabase設定があればクラウド、無ければ端末保存 ─────────── */
export default function App() {
  return supabase ? <CloudApp /> : <LocalApp />;
}

const lbl = { display:"block", fontSize:12, color:"var(--ink-dim)", margin:"0 0 7px", letterSpacing:".02em" };
const inp = { width:"100%", marginBottom:18, padding:"12px 13px", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10, color:"var(--ink)", fontSize:15, fontFamily:"inherit" };
function chip(on){ return { background: on?"var(--amber)":"var(--surface)", color: on?"#1a1305":"var(--ink-dim)", border:`1px solid ${on?"var(--amber)":"var(--line)"}`, borderRadius:20, padding:"7px 13px", fontSize:13, cursor:"pointer", fontWeight: on?700:400 }; }
const snsBtn = { flex:1, padding:"13px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink)", fontWeight:700, fontSize:14, cursor:"pointer" };
