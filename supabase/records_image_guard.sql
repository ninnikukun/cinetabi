-- ═══════════════════════════════════════════════════════════════
-- シネたび セキュリティ監査対応：records.image のサーバー側サイズ・形式チェック
-- （docs/SECURITY_AUDIT.md 項目4）
--
-- ✅ 適用済み（2026-08-10、本番Supabaseプロジェクトに適用・Success確認済み）
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / 冪等な書き方にしています。
--
-- ※ 実行前に、現在の records テーブルに条件を満たさない行（image が
--    2,000,000文字を超える、または 'data:image/' で始まらない）が
--    無いか確認してください。既存データが違反する場合、この制約の追加自体が
--    エラーになります。心当たりが無ければ通常は問題ありません
--    （クライアント側は常に canvas.toDataURL("image/jpeg", ...) で
--    data:image/jpeg;base64,... 形式・長辺1000px程度に縮小してから送信している）。
-- ═══════════════════════════════════════════════════════════════

-- 背景：
--   写真はクライアント側（resizeImage / cropToAspectDataUrl）で縮小してから
--   base64のdata URLとしてDBに直接保存している（Supabase Storageではない）。
--   これはクライアント側の制御でしかなく、ログイン済みユーザーがAPIを直接叩けば
--   リサイズをバイパスして任意サイズの文字列を送り込める。RLSにより他人の行は
--   書き換えられないため直接の情報漏えいにはならないが、自分の行を極端に肥大化
--   させてDBコスト・表示側の負荷につながる可能性があるため、サーバー側にも
--   上限を設ける。

alter table public.records
  drop constraint if exists records_image_size_check;

alter table public.records
  add constraint records_image_size_check
  check (
    image is null
    or (
      length(image) <= 2000000  -- 目安：長辺1000px・品質0.75のJPEGをbase64化した実測値に余裕を持たせた上限
      and image like 'data:image/%'
    )
  );
