-- ═══════════════════════════════════════════════════════════════
-- シネたび セキュリティ監査対応：コアテーブル（profiles・records）のRLS定義
-- （docs/SECURITY_AUDIT.md 項目5）
--
-- ⚠⚠⚠ 重要：このファイルはSupabaseダッシュボードの実際の設定を書き出した
-- ものではありません（このセッションからは稼働中のSupabaseプロジェクトに
-- 接続する手段が無く、ダッシュボードの現在の設定を照会できませんでした）。
--
-- 代わりに、以下の間接的な根拠から「本来こうなっているはず」の内容を
-- 再構成したものです：
--   ・CLAUDE.md「記録データ：records テーブル。RLSで『本人のみ』＋
--     （ステージ2以降）『承認済みフォロワーも閲覧可』」
--   ・stage2_follows.sql のコメント「既存の『本人だけ読み書きできる』
--     ポリシーはそのまま（ポリシーはORで合成される）」
--   ・アプリのコード（src/App.jsx）が実際に行っている操作
--     （profiles: 自分の行のinsert/update、records: 自分の行のinsert/
--     update/delete、フォロー中の相手のrecordsをselect）
--
-- 【適用前に必ず行うこと】
--   1. Supabaseダッシュボード → Authentication → Policies で、
--      profiles・records の現在のポリシーをこのファイルと見比べる。
--   2. 内容が一致するなら、このファイルは「今の設定をコードとして
--      残しただけ」になり、実行しても実質的な変更は無いはず。
--   3. 差異がある場合（例：もっと緩い/厳しい既存ポリシーがある）は、
--      このファイルの内容を実態に合わせて修正してから実行するか、
--      このファイルを実行せず、ダッシュボードの現状をそのまま正として
--      別途書き出すこと。このファイルを盲目的に実行して既存のポリシーを
--      上書きしないよう注意する（create policy は drop policy if exists
--      とセットのため、既存の同名ポリシーは中身ごと置き換わる）。
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
