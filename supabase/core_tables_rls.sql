-- ═══════════════════════════════════════════════════════════════
-- シネたび セキュリティ監査対応：コアテーブル（profiles・records）のRLS定義
-- （docs/SECURITY_AUDIT.md 項目5）
--
-- ✅ 適用済み（2026-08-10、本番Supabaseプロジェクトに適用・Success確認済み）
--
-- 元々このファイルは、稼働中のSupabaseプロジェクトに接続する手段が無い
-- 状態で、CLAUDE.mdの記述・stage2_follows.sqlのコメント・アプリの実際の
-- クエリ操作から「本来こうなっているはず」の内容を推測で再構成したもの
-- だった。適用前にダッシュボードの実際のポリシー一覧と照合したところ、
-- ほぼ一致していたが1点差分があった：
--
--   ・records_update_own（UPDATE, user_id = auth.uid()）が実際には
--     存在しなかった。records テーブルには元々 records 自身のUPDATEポリシー
--     が無く、本人による記録編集がRLSレベルでは許可されていなかったと
--     見られる。本人に確認のうえ、このファイルの内容どおり新規追加した
--     （編集機能のための想定どおりの追加という結論）。
--
-- 他の全ポリシー（profiles_select_own / profiles_insert_own /
-- profiles_update_own / records_select_own / records_insert_own /
-- records_delete_own）は、ダッシュボードの実際の設定と完全に一致していた。
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / drop policy if exists で
-- 書いています。
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) profiles
--    ・本人の行のみ 参照・追加・更新できる（削除は想定機能が無いため対象外）
--    ・フォロー関係の当事者どうしへの追加公開は stage2_follows.sql の
--      profiles_select_follow_parties が別途担っている（このファイルでは
--      触れない）
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────
-- 2) records
--    ・本人の行のみ 参照・追加・更新・削除できる
--    ・承認済みフォロワーへの追加公開は stage2_follows.sql の
--      records_select_accepted_followers が別途担っている（このファイルでは
--      触れない）
-- ─────────────────────────────────────────────
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
  for select using (user_id = auth.uid());

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
  for insert with check (user_id = auth.uid());

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own" on public.records
  for delete using (user_id = auth.uid());
