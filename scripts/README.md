# 映画館データ収集パイプライン（1都道府県＝1バッチのランブック）

「消えた映画館の記憶」(https://hekikaicinema.memo.wiki/, CCライセンス・サイト名表示条件) から
営業中の映画館を抽出し、`api/data/curated/` に都道府県（東京は区）単位のファイルとして追加する手順。

進行順（決定済み）: 関東（完了）→ 中部 → 関西 → その他の地方ブロック

## 運用上の注意（ハマりどころ）

- **devサーバーの再起動が必要**: `api/cinemas.js` は `api/data/curated/` の全JSONをサーバー起動時に
  一度だけ読み込む。ファイル追加後にローカル確認する場合は、devサーバーを再起動しないと反映されない。
- **closed-cinemas.jsonへの追加は必ず目視確認**: `check-osm-closed.js` の`[closed]`候補はnameMatch()の
  部分一致による誤検出があり得る（例: 「イオンシネマ座間」が閉館館「米ケ浜シネマ座」の一部「シネマ座」に
  誤って一致）。機械的に採用せず、営業中リストとの重複がないか毎回確認する。

## 手順

作業ファイルは一時ディレクトリ（`$SCRATCH` など）に置き、リポジトリには最終JSONだけを入れる。

### 0. 対象ページの洗い出し

`scripts/wiki-page-list.txt` に、wikiの全ページ一覧（`https://hekikaicinema.memo.wiki/l/`）から
抽出した「〜の映画館」ページ323件のマスターリストがある。対象都道府県の市区町村名でgrepして
対象ページを確定させる（トップページ・ランディングページを都度たどるより確実）。

```
grep -E "新潟市|長岡市|..." scripts/wiki-page-list.txt
```

### 1. wikiから抽出

```
node scripts/scrape-wiki.js 新宿区の映画館 $SCRATCH/scraped.json
```

- ページ名はwikiトップページのリンクテキストと完全一致させる（例:「新宿区の映画館」「札幌市の映画館」）
- 複数ページを1バッチにまとめる場合はページ名を並べる
- `[要確認] 所在地が取れていません` が出た館は元ページを目視確認

### 2. 実在検証（重要）

wikiの「営業中」は編集が古い可能性がある。営業中リストの各館について:

- 公式サイトが取れている館 → URLが生きているか確認
- 取れていない館 → WebSearchで「<館名> 公式サイト」を検索し、営業状況と公式サイトを確認
- どこにも情報がない館 → 閉館・移転を疑い、確認できるまで curated に入れない
  （渋谷区の「HACK」のような正体不明データを混入させないため）

注意: 複数館が同居していたブロック（例: 渋谷TOEI→Bunkamuraル・シネマ）は、
wikipediaTitle が旧館のものになっていることがある。website付与前に目視確認する。

### 3. ジオコーディング

```
node scripts/geocode.js --region 東京都新宿区 $SCRATCH/scraped.json $SCRATCH/geocoded.json
```

- POI名 → 番地住所 → 丁目 → 町名 の順にフォールバック。全失敗は `precision: "failed"`
- `failed` の館は Googleマップ等で座標を手動確認して補う（precisionは実態に合わせ poi / neighbourhood）
- `neighbourhood` はアプリ上で「おおよその位置」表示になる

### 4. 公式サイト付与

```
node scripts/add-website-links.js $SCRATCH/geocoded.json $SCRATCH/with-website.json
```

- wikiに公式サイトがあった館（`website` が既にある）はそのまま
- Wikipedia infoboxから取れなかった館は WebSearch で補完し手動で追記
- Wikipedia infoboxの外部リンクが入居施設（モール等）を指していることがある（例:
  ヒューマントラストシネマ有楽町でitocia.jp＝モールのサイトが誤って入った事例）。
  次のOSM突合ステップでOSM側のwebsiteタグがあれば優先して差し替える。

### 5. OSM閉館突合・website優先順位の適用

```
node scripts/check-osm-closed.js --region 東京都新宿区 $SCRATCH/scraped.json $SCRATCH/geocoded.json
```

出力の見方（自動で確定させず、必ず目視確認する）:

| ラベル | 意味 | やること |
|---|---|---|
| `[ok]` | 営業中と名前一致 | なし |
| `[closed]` | wikiの閉館館と名前一致 | 候補JSONを確認して `api/data/closed-cinemas.json` に貼り付け |
| `[要確認]` | 閉館・営業中の両方に一致（旧名タグの現役館 or 同名の別館） | 座標・閉館日で判断 |
| `[ok?]` | 近接のみ一致（名前不一致） | 英字表記の同一館か、近くの別の閉館館かを確認 |
| `[unknown]` | どれとも一致しない | WebSearchで実在確認。確認できなければ closed-cinemas.json で除外 |

**website優先順位**: OSMのwebsiteタグ（実座標に紐づく） > wiki本文/Wikipedia infoboxの公式サイト
（モール等の誤リンクの可能性あり） > null。`[ok]`（名前一致）した館でOSM側にwebsiteタグがあれば
末尾に「websiteをOSM側の値に差し替える候補」として出力されるので、目視確認のうえ適用する。
モールドメインらしきURLしか無くOSMにもタグが無い場合は、無理に埋めずnullのままにする
（誤ったリンクを出すより「無し」の方が安全）。null化した館は `scripts/website-todo.json` に
`{name, address, file, previousWebsite, reason}` の形で記録し、後日の個別調査に回す
（自動処理はしない）。

**座標乖離チェック**: 名前一致した館について、curated側の座標とOSM実座標の距離が2000mを超えると
「座標がOSM実座標と2000m以上離れている館」として警告される。ジオコーディング誤り（住所の町名レベル
フォールバックが誤った地点にヒットする等）の早期発見に使う。ただし「イオンシネマ」「109シネマズ」
のようにブランド名のみで支店名を持たないOSMタグは、同一県内の複数館すべてと部分一致してしまうため、
`nearestByName`（名前一致した候補のうち最も近い1件を採用）で誤ペアリングを防いでいる。それでも
偽陽性が出ることがあるので、座標乖離が出たら必ず目視確認する。

### 6. 保存と動作確認

1. 検証済みデータを `api/data/curated/<地域>.json` として保存（例: `tokyo-shinjuku.json`）
   - 必須フィールド: `name`, `address`, `lat`, `lon`, `precision`, `website`
   - `wikipediaTitle`, `sourcePage` は残してよい（APIはクライアントに送らない）
2. ローカルdevで対象地域の主要駅を検索し、件数・名前・徒歩分・公式サイトリンクを確認
   ```
   npm run dev
   curl "http://localhost:5173/api/cinemas?q=新宿駅"
   ```
3. `npm run build` が通ることを確認

### 7. 品質ゲート（コミット前チェック）

- [ ] 件数: 映画館情報サイト（eiga.com等の地域別リスト）の掲載数と大きく乖離していない
- [ ] 全座標が対象地域内にある（geocode.jsのbboxチェックで担保、failedは手動解決済み）
- [ ] 主要駅検索で重複・閉館館が出ない
- [ ] precision の `poi` 比率を確認（`neighbourhood` ばかりなら住所抽出の質を疑う）
- [ ] 公式サイトURLが全館分あり、リンク切れがない

### 8. コミット

1バッチ＝1コミット。ユーザー確認後にpush（Vercel自動デプロイ）。

## レート制限（スクリプトに組み込み済み）

| サービス | 制限 | 実装 |
|---|---|---|
| wiki (seesaawiki) | 良識の範囲 | ページ間2秒待機・UAに連絡先明記 |
| Nominatim | 1リクエスト/秒 | 1.1秒待機 |
| Wikipedia | 良識の範囲 | 500ms待機 |
| Overpass | 混雑時504 | 地域あたり1クエリ・504時は15秒後に1回リトライ |

いずれも無料の共有インフラ。バッチを連続実行する場合も1バッチずつ、検証を挟みながら進める。
