-- ═══════════════════════════════════════════════════════════════
-- シネたび §8 プロフィール画像アバター：DB・Storageのみ（表示側は未対応）
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / drop policy if exists で書いています。
--
-- ※ 3) の storage.objects へのポリシー作成が
--    「must be owner of table objects」というエラーで失敗する場合は、
--    ダッシュボード → Storage → avatars → Policies から、同じ条件で
--    手動作成してください（そちらは必要な権限で実行されます）。
--    その場合でも 1) 2) は先に実行されている必要があります。
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) profiles にアバター画像のURLを追加
--    ・画像そのものは Storage に置き、ここにはURLだけを持つ
--    ・null のユーザーは従来どおり「表示名の頭文字の丸」で表示する
--      （フォールバックは残す方針。§8参照）
-- ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;

-- 本人が自分の avatar_url を更新できるようにする。
-- profiles に列単位のUPDATE権限が設定されている場合に必要（テーブル単位で
-- 付与済みなら何も起きない）。更新できる行の制御は既存のRLSポリシーが行う。
grant update (avatar_url) on public.profiles to authenticated;

-- ※ 参照については追加のポリシーは不要。
--    既存の profiles_select_follow_parties は行単位のポリシーなので、
--    フォロー関係の当事者には avatar_url も自動的に見える。

-- ─────────────────────────────────────────────
-- 2) アバター画像用のStorageバケット
--    ・public = true：画像URLを <img> でそのまま表示するため公開読み取り可
--    ・1ユーザー1ファイル（avatars/{user_id}.jpg）を上書き保存する運用
--    ・サイズ・形式の上限をバケット側にも設けて、想定外の巨大ファイルや
--      画像以外のアップロードを防ぐ（クライアント側でも長辺400px程度に縮小する）
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────
-- 3) Storageのアクセス制御（storage.objects のポリシー）
--    ・読み取り：誰でも可（公開バケット）
--    ・書き込み：自分のファイル（{自分のuser_id}.jpg）だけ
--
--    ※ storage.objects はSupabase側で既にRLSが有効なので、
--      enable row level security は実行しないこと（権限エラーになり、
--      SQL Editorは全体が1トランザクションのため 1) 2) ごと巻き戻る）。
--
--    ※ name の条件で「自分のIDのファイル名」に固定しているため、
--      他人のファイルを上書きすることはできない。
--      拡張子は .jpg 固定。将来pngも許可する場合はこの条件を広げる必要がある。
-- ─────────────────────────────────────────────

-- 読み取り：アプリ内の表示だけでなく、公開URLでの取得も想定
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- 新規アップロード（初回）
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  );

-- 上書き保存（2回目以降）
-- 固定パスに upsert する運用なので、insertだけでは2回目以降が失敗する。
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  )
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  );

-- 削除（アバターを外す操作用）
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  );
