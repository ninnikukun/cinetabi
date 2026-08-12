-- ═══════════════════════════════════════════════════════════════
-- シネたび：records.image のサーバー側チェックを、base64形式からStorageの
-- パス形式チェックに置き換える（records_image_guard.sql の後継）
-- （docs/SECURITY_AUDIT.md 項目7）
--
-- record_photos_storage.sql を先に実行してから、このファイルを実行してください。
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / 冪等な書き方にしています。
--
-- ⚠️ 実行前に、現在のrecordsテーブルにbase64形式（image like 'data:image/%'）
--    の行が残っていないか必ず確認してください。残っている場合、この制約の
--    追加自体がエラーになります。
--
--    旧データはsrc/App.jsxのmigrateLegacyBase64Photos()が、各ユーザーの
--    次回ログイン時に自動でStorageへ移行します（他ユーザーの記録もあるため、
--    削除して撮り直す運用ではなく自動移行に変更済み）。以下のクエリが0件に
--    なった（＝対象ユーザー全員が一度アプリを開き終えた）のを確認してから
--    このSQLを実行してください：
--    select id, user_id, watched_at from public.records
--           where image like 'data:%';
-- ═══════════════════════════════════════════════════════════════

alter table public.records
  drop constraint if exists records_image_size_check; -- 旧base64形式チェック（records_image_guard.sql）

alter table public.records
  drop constraint if exists records_image_path_check;

alter table public.records
  add constraint records_image_path_check
  check (
    image is null
    or (
      length(image) <= 300 -- パス文字列なので十分な余裕を持たせた上限
      and image ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.jpg$' -- {user_id}/{uuid}.jpg
    )
  );
