# シネたび CINETABI

観た映画を記録して、でかける先の映画館をさがすWebアプリ。

- 記録：タイトル検索 → ポスター自動表示（TMDB）→ 文章・おもいで写真を添えて保存
- 記録は端末に保存（localStorage）
- でかける：エリアを選び、駅から徒歩の所要時間で映画館をしぼって一覧
- 共有：記録を1枚の画像にしてSNSへ

---

## はじめての公開（ぜんぶブラウザだけ・パソコンの専門ツール不要）

順番にやれば、つまずきません。所要 約30〜60分。

### STEP 1. TMDBのAPIキーをもらう（無料）
本物の映画検索・ポスターを出すための鍵です。

1. https://www.themoviedb.org/ で無料登録（メール認証）
2. ログイン後、右上アイコン → 「設定(Settings)」 → 左メニューの「API」
3. 「Create / Request an API Key」→ 用途は「Developer」、内容は簡単でOK（個人の趣味アプリ等）
4. 発行された **「API Key (v3 auth)」** の文字列をコピーして、メモしておく

※ キーが無い間も、アプリはデモ用の映画リストで動きます。キーを入れると本物の検索に切り替わります。

### STEP 2. コードをGitHubに置く（無料）
1. https://github.com/ で無料登録
2. 右上「＋」→「New repository」→ 名前を `cinetabi` などにして「Create repository」
3. 作成後の画面で「uploading an existing file」をクリック
4. この `cinetabi` フォルダの **中身（package.json や src フォルダなど全部）** をドラッグ＆ドロップ
   - ※ `node_modules` は入れない（無くてOK。Vercelが用意します）
5. 「Commit changes」

### STEP 3. Vercelで公開（無料）
1. https://vercel.com/ に「Continue with GitHub」で登録
2. 「Add New…」→「Project」→ さっきの `cinetabi` リポジトリを「Import」
3. Framework は自動で「Vite」が選ばれます（そのままでOK）
4. 「Environment Variables」を開き、次を1つ追加：
   - Name: `TMDB_API_KEY`
   - Value: STEP1でコピーしたキー
5. 「Deploy」を押す → 数十秒で `https://cinetabi-xxxx.vercel.app` のような**公開URL**が出ます 🎉

### STEP 4. 独自ドメインをつなぐ（任意・年1,000〜2,000円ほど）
1. レジストラ（お名前.com / Cloudflare / Namecheap など）で好きなドメインを購入
2. Vercel → 対象プロジェクト → 「Settings」→「Domains」→ 買ったドメインを入力
3. Vercelが「このDNS設定をレジストラに入れてね」と表示するので、その通りに（A レコードや CNAME）レジストラ側へ入力
4. 反映まで数分〜数時間。完了するとそのドメインで開けます

---

## 直したくなったら（アップデート方法）
GitHub上のファイルを編集（または再アップロード）して Commit すると、Vercel が自動で再公開します。
Claudeに「ここをこう変えたい」と相談 → もらったコードでファイルを差し替え → Commit、の流れでOK。

環境変数（TMDBキー）を変えたときは、Vercel の Deployments から「Redeploy」を1回押すと反映されます。

---

## いまの状態と、この先できること（正直メモ）
- ✅ 本物：映画の検索・ポスター・あらすじ（TMDB）／記録・おもいで写真・共有
- ⏳ デモのまま：映画館の一覧（場所・徒歩分）。本番化は各館のアクセス情報から「館名・最寄り駅・徒歩分」を集めてデータ化する作業（無料・手作業）
- ⏳ 未実装：「いまその館で何を上映中か」。毎週変わるため、提携や手動更新が必要
- 記録は端末ごとの保存です（別の端末やブラウザには引き継がれません）。端末をまたいで同期したくなったら、ログイン基盤（Supabase等の無料枠）を後付けできます

---

## 開発者向け（任意）
パソコンにNode.jsがある場合のみ：

```
npm install
npm run dev      # 画面の確認（検索はデモにフォールバック）
```

検索APIまで含めてローカルで試すには Vercel CLI を使います：

```
npm i -g vercel
vercel dev       # .env に TMDB_API_KEY を入れておく
```

公開サイトでは `/api/tmdb` が自動で動くので、ローカルで試さなくても問題ありません。
