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
        <img src={TMDB_IMG + film.posterPath} alt={film.title} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
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

/* ── 端末保存（localStorage） ── */
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
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap');
* { box-sizing: border-box; }
body { margin:0; }
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
@media (prefers-reduced-motion: no-preference){ .fade-up{ animation:fadeUp .42s cubic-bezier(.2,.7,.2,1) both; } }
@keyframes fadeUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:none;} }
@media (min-width: 900px){
  .reel-root { max-width:1000px; }
  .reel-grid { display:grid; grid-template-columns:1fr 1fr; align-items:start; }
  .reel-photo-grid { grid-template-columns:repeat(5,1fr); }
  .reel-fab { left:auto !important; right:32px !important; transform:none !important; width:auto !important; padding-left:28px !important; padding-right:28px !important; }
}
.reel-btn:focus-visible, .reel-tap:focus-visible, input:focus-visible, textarea:focus-visible { outline:2px solid var(--amber); outline-offset:2px; }
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
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", padding:"8px 20px 28px" }}>
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

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={onClose}>
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", padding:"8px 20px 28px" }}>
        <div style={{ width:42, height:4, borderRadius:4, background:"var(--line)", margin:"10px auto 18px" }} />

        {!selected ? (
          <>
            <div className="reel-mark" style={{ letterSpacing:".18em", fontSize:12, color:"var(--amber)", marginBottom:14 }}>SEARCH ／ 作品を検索して記録</div>
            <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="タイトルで検索（例：君の名は）" style={inp} />
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
                <img src={image} alt="" style={{ width:"100%", borderRadius:12, display:"block", maxHeight:320, objectFit:"cover" }} />
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
    </div>
  );
}

/* ─────────── 記録一覧 ─────────── */
const navBtn = (side) => ({ position:"absolute", top:"50%", [side]:8, transform:"translateY(-50%)", width:38, height:38, borderRadius:"50%", border:"none", background:"rgba(12,13,22,.62)", color:"#fff", fontSize:22, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(2px)" });

function PhotoTile({ m, mode, onClick }) {
  const showPhoto = mode === "photo" && m.image;
  return (
    <button className="reel-tap" onClick={onClick} style={{ padding:0, border:"none", cursor:"pointer", display:"block", position:"relative", background:"var(--surface2)", overflow:"hidden" }}>
      {showPhoto
        ? <img src={m.image} alt="" loading="lazy" style={{ width:"100%", aspectRatio:"2 / 3", objectFit:"cover", display:"block" }} />
        : <Poster film={{ title:m.title, posterPath:m.posterPath || null, year:m.year }} style={{ width:"100%", borderRadius:0 }} />}
      {m.image && <span style={{ position:"absolute", top:5, right:5, fontSize:9, background:"rgba(0,0,0,.5)", padding:"2px 5px", borderRadius:10 }}>📸</span>}
    </button>
  );
}

function EditSheet({ movie, onClose, onSave }) {
  const [note, setNote] = useState(movie.note || "");
  const [image, setImage] = useState(movie.image || null);
  const [date, setDate] = useState(() => { try { return new Date(movie.watchedAt).toISOString().slice(0,10); } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

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

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", background:"rgba(4,5,10,.66)" }} onClick={onClose}>
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", padding:"8px 20px 28px" }}>
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
            <img src={image} alt="" style={{ width:"100%", borderRadius:12, display:"block", maxHeight:320, objectFit:"cover" }} />
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
    </div>
  );
}

function DetailView({ movies, index, onClose, onShare, onDelete, onUpdate }) {
  const [i, setI] = useState(index);
  const m = movies[i];
  const [mode, setMode] = useState(m && m.image ? "photo" : "poster");
  useEffect(() => { const mm = movies[i]; setMode(mm && mm.image ? "photo" : "poster"); }, [i, movies]);
  useEffect(() => {
    const h = (e) => { if (e.key === "ArrowLeft") setI(x=>Math.max(0,x-1)); else if (e.key === "ArrowRight") setI(x=>Math.min(movies.length-1,x+1)); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [movies.length, onClose]);
  const [editing, setEditing] = useState(false);
  if (!m) return null;
  const film = { title:m.title, posterPath:m.posterPath || null, year:m.year };
  const showPhoto = mode === "photo" && m.image;
  const del = () => { onDelete(m.id); onClose(); };
  const q = encodeURIComponent(m.title);
  const openExt = (url) => { try { window.open(url, "_blank", "noopener"); } catch {} };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"var(--bg)", overflowY:"auto" }}>
      <div className="reel-sheet" style={{ padding:"calc(env(safe-area-inset-top, 0px) + 14px) 16px 44px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <button className="reel-tap" onClick={onClose} style={{ background:"none", border:"none", color:"var(--ink)", fontSize:15, cursor:"pointer" }}>‹ もどる</button>
          <span className="reel-mark" style={{ fontSize:11, color:"var(--ink-dim)" }}>{i+1} / {movies.length}</span>
        </div>
        <div style={{ position:"relative" }}>
          {showPhoto
            ? <img src={m.image} alt="" style={{ width:"100%", maxHeight:"62vh", objectFit:"cover", borderRadius:16, display:"block" }} />
            : <Poster film={film} big style={{ width:"100%", maxWidth:340, margin:"0 auto" }} />}
          {i>0 && <button className="reel-tap" onClick={()=>setI(i-1)} aria-label="前へ" style={navBtn("left")}>‹</button>}
          {i<movies.length-1 && <button className="reel-tap" onClick={()=>setI(i+1)} aria-label="次へ" style={navBtn("right")}>›</button>}
        </div>
        {m.image && (
          <div style={{ display:"flex", gap:6, marginTop:12 }}>
            {[["poster","ポスター"],["photo","おもいで"]].map(([v,t]) => (
              <button key={v} className="reel-tap" onClick={()=>setMode(v)} style={{ flex:1, padding:"8px", borderRadius:9, border:"1px solid var(--line)", cursor:"pointer", fontSize:12.5, fontWeight:700, background: mode===v?"var(--surface2)":"transparent", color: mode===v?"var(--ink)":"var(--ink-dim)" }}>{t}</button>
            ))}
          </div>
        )}
        <h2 style={{ margin:"16px 0 4px", fontSize:22, fontWeight:900, lineHeight:1.3 }}>{m.title}</h2>
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
        <div style={{ display:"flex", gap:10, marginTop:10 }}>
          <button className="reel-btn" onClick={()=>onShare(m)} style={{ flex:1, padding:"13px", borderRadius:11, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:14, cursor:"pointer" }}>共有する</button>
          <button className="reel-tap" onClick={()=>setEditing(true)} style={{ padding:"13px 18px", borderRadius:11, border:"1px solid var(--line)", background:"transparent", color:"var(--ink)", fontSize:14, fontWeight:700, cursor:"pointer" }}>編集</button>
          <button className="reel-tap" onClick={del} style={{ padding:"13px 18px", borderRadius:11, border:"1px solid var(--line)", background:"transparent", color:"var(--ink-dim)", fontSize:14, cursor:"pointer" }}>削除</button>
        </div>
      </div>
      {editing && <EditSheet movie={m} onClose={()=>setEditing(false)} onSave={onUpdate} />}
    </div>
  );
}

const RECAP_MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
function RecapView({ movies, user, onClose }) {
  const now = new Date();
  const list = movies.filter(m => { const d = new Date(m.watchedAt); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const tiles = list.slice(0, 5);
  const extra = list.length - tiles.length;
  const share = async () => { try { if (navigator.share) await navigator.share({ title:"シネたび", text:`${now.getMonth()+1}月は ${list.length}本 観ました🎬 #シネたび` }); } catch {} };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(4,5,10,.82)", overflowY:"auto", padding:"calc(env(safe-area-inset-top, 0px) + 20px) 0 20px" }} onClick={onClose}>
      <div className="reel-sheet" onClick={e=>e.stopPropagation()} style={{ padding:"0 16px" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <button className="reel-tap" onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:14, cursor:"pointer" }}>✕ 閉じる</button>
        </div>
        <div style={{ border:"1px solid var(--line)", borderRadius:18, overflow:"hidden", background:"linear-gradient(180deg, rgba(232,176,75,.12), transparent 42%), var(--surface)" }}>
          <div style={{ padding:"18px 18px 10px" }}>
            <div className="reel-mark" style={{ letterSpacing:".2em", fontSize:11, color:"var(--amber)" }}>{RECAP_MONTHS[now.getMonth()]} {now.getFullYear()}</div>
            <div style={{ fontWeight:900, fontSize:22 }}>{now.getMonth()+1}月は {list.length}本 観ました🎬</div>
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
  const [recap, setRecap] = useState(false);
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
  const monthCount = movies.filter(m => { const d = new Date(m.watchedAt); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); }).length;

  return (
    <div style={{ padding:"10px 0 110px" }}>
      <div className="reel-narrow" style={{ padding:"0 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span className="reel-mark" style={{ fontSize:12.5, color:"var(--ink-dim)", letterSpacing:".06em" }}>{now.getFullYear()}年 {yearCount}本</span>
          {hasAnyPhoto && (
            <div style={{ display:"flex", border:"1px solid var(--line)", borderRadius:9, overflow:"hidden" }}>
              {[["poster","ポスター"],["photo","おもいで"]].map(([v,t]) => (
                <button key={v} className="reel-tap" onClick={()=>setThumb(v)} style={{ padding:"6px 13px", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, background: thumb===v?"var(--amber)":"transparent", color: thumb===v?"#1a1305":"var(--ink-dim)" }}>{t}</button>
              ))}
            </div>
          )}
        </div>
        {monthCount>0 && (
          <button className="reel-tap" onClick={()=>setRecap(true)} style={{ width:"100%", textAlign:"left", cursor:"pointer", border:"1px solid var(--amber-dim)", background:"linear-gradient(180deg, rgba(232,176,75,.10), transparent)", borderRadius:14, padding:"12px 15px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>
              <span className="reel-mark" style={{ fontSize:10, letterSpacing:".2em", color:"var(--amber)" }}>THIS MONTH</span>
              <span style={{ display:"block", fontWeight:900, fontSize:15, marginTop:3 }}>{now.getMonth()+1}月は {monthCount}本 観ました🎬</span>
            </span>
            <span style={{ color:"var(--amber)", fontWeight:900, fontSize:18 }}>›</span>
          </button>
        )}
      </div>

      <div className="reel-photo-grid reel-narrow">
        {movies.map((m, i) => <PhotoTile key={m.id} m={m} mode={thumb} onClick={()=>setDetail(i)} />)}
      </div>

      {detail !== null && <DetailView movies={movies} index={detail} onClose={()=>setDetail(null)} onShare={onShare} onDelete={onDelete} onUpdate={onUpdate} />}
      {recap && <RecapView movies={movies} user={user} onClose={()=>setRecap(false)} />}
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
                <div style={{ margin:"5px 0 0", fontSize:13, color:"var(--amber-dim)" }}>約 徒歩{c.walk}分（約{c.dist >= 1000 ? (c.dist/1000).toFixed(1)+"km" : c.dist+"m"}）</div>
              </article>
            ))}
            </div>
            <p style={{ textAlign:"center", color:"var(--line)", fontSize:11, marginTop:14, lineHeight:1.6 }}>映画館データ：OpenStreetMap ／ 徒歩分は直線距離からの概算です</p>
          </>
        )
      )}
    </div>
  );
}

/* ─────────── メインの画面（記録/でかける）。データ源に依存しない共通シェル ─────────── */
function Shell({ user, movies, loading, onAddMovie, onDeleteMovie, onUpdateMovie, onLogout, isAnonymous }) {
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
          {[["log","記録"],["find","でかける"]].map(([v,t]) => (
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
        : <FindView />}

      {view === "log" && !loading && movies.length > 0 && (
        <button className="reel-btn reel-fab" onClick={()=>setAdding(true)} aria-label="記録を追加"
          style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", maxWidth:520, width:"calc(100% - 32px)", padding:"15px", borderRadius:14, border:"none", background:"var(--amber)", color:"#1a1305", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:"0 8px 30px rgba(232,176,75,.25)" }}>＋ 映画を記録</button>
      )}

      {adding && <AddSheet onClose={()=>setAdding(false)} onSave={onAddMovie} existingIds={movies.map(m=>m.filmId).filter(Boolean)} />}
      {sharing && <ShareSheet movie={sharing} user={user} onClose={()=>setSharing(null)} />}
      {connecting && <ConnectSheet onClose={()=>setConnecting(false)} />}
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
      <div className="fade-up reel-sheet" onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", borderTop:"1px solid var(--line)", borderRadius:"22px 22px 0 0", maxHeight:"92vh", overflowY:"auto", padding:"8px 20px 28px" }}>
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
        const { data: recs } = await supabase.from("records").select("*").order("watched_at", { ascending: false });
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
  return <Shell user={{ name: profile.display_name }} movies={movies} loading={loading} onAddMovie={addMovie} onDeleteMovie={deleteMovie} onUpdateMovie={updateMovie} onLogout={isAnonymous ? undefined : logout} isAnonymous={isAnonymous} />;
}

/* ─────────── ルート：Supabase設定があればクラウド、無ければ端末保存 ─────────── */
export default function App() {
  return supabase ? <CloudApp /> : <LocalApp />;
}

const lbl = { display:"block", fontSize:12, color:"var(--ink-dim)", margin:"0 0 7px", letterSpacing:".02em" };
const inp = { width:"100%", marginBottom:18, padding:"12px 13px", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10, color:"var(--ink)", fontSize:15, fontFamily:"inherit" };
function chip(on){ return { background: on?"var(--amber)":"var(--surface)", color: on?"#1a1305":"var(--ink-dim)", border:`1px solid ${on?"var(--amber)":"var(--line)"}`, borderRadius:20, padding:"7px 13px", fontSize:13, cursor:"pointer", fontWeight: on?700:400 }; }
const snsBtn = { flex:1, padding:"13px", borderRadius:10, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--ink)", fontWeight:700, fontSize:14, cursor:"pointer" };
