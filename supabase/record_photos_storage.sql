-- ═══════════════════════════════════════════════════════════════
-- シネたび：records.image をbase64直置きからSupabase Storageへ移行
-- （docs/SECURITY_AUDIT.md 項目7）
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / drop policy if exists で書いています。
--
-- ※ 3) の storage.objects へのポリシー作成が
--    「must be owner of table objects」というエラーで失敗する場合は、
--    ダッシュボード → Storage → record-photos → Policies から、
--    同じ条件で手動作成してください（avatar_upload.sqlの時と同じ既知の制約）。
--    その場合でも 1)〜2) は先に実行されている必要があります。
--
-- 適用順序（重要）：
--   1. このファイルを実行する（バケット作成・ポリシー設定）
--   2. records_image_path_guard.sql を実行する
--      （records_image_guard.sql の古いbase64形式チェックを、
--       Storageパス形式のチェックに置き換える）
--   3. 新しいクライアントコードをデプロイする
--   4. アプリ内で、既存の記録（旧base64形式のimageを持つもの）を
--      削除して撮り直す（件数が少ないため手作業で対応する方針）
-- ═══════════════════════════════════════════════════════════════

-- 背景：
--   おもいで写真をこれまでDBのrecords.imageにbase64のdata URLとして直接
--   保存していた（records_image_guard.sqlで2MB相当を上限に制限）。
--   件数・サイズが増えるとDBの行サイズ・バックアップ容量を圧迫するため、
--   実体はSupabase Storageの非公開バケットに置き、records.imageには
--   「バケット内の相対パス」だけを保存する形に変える。
--
--   閲覧は署名付きURL（期限付き）で行う。発行の可否はサーバー側の関数を
--   別途用意するのではなく、records と全く同じ「本人 or 承認済み
--   フォロワー」の条件を storage.objects のRLSポリシーにも設定することで、
--   ブラウザの認証済みSupabaseクライアントから直接 createSignedUrl を
--   呼べるようにする（Supabaseの createSignedUrl はStorage側のSELECT
--   ポリシーに従う。追加のサーバー関数やservice_role鍵は不要）。

-- ─────────────────────────────────────────────
-- 1) バケット作成
--    ・public = false：直接URLでのアクセスは不可（署名付きURL経由のみ）
--    ・パスは {user_id}/{ランダムなuuid}.jpg 固定（本人のフォルダ配下）
--    ・1レコード1ファイル。上書きはしない（編集で写真を差し替えた時は
--      新しいパスで保存し、クライアント側で古いオブジェクトを削除する）
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-photos', 'record-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────
-- 2) （参考）records側は変更なし
--    ・records.image は既存の列をそのまま使う（型はtext、値の意味だけが
--      「base64のdata URL」から「Storageの相対パス」に変わる）
--    ・records_select_own / records_select_accepted_followers
--      （core_tables_rls.sql / stage2_follows.sql）は変更不要。
--      パスの読み取り可否をこの既存ポリシーがそのまま制御し、
--      3)のStorageポリシーはそれと同じ条件を関連テーブル参照で再現している
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 3) Storageのアクセス制御（storage.objects のポリシー）
--    ・読み取り（署名付きURL発行を含む）：
--        本人の記録の写真、または「承認済みフォロワーとして見られる」
--        記録の写真だけ。records.image = このオブジェクトのパス、を
--        条件にrecordsテーブルを参照し、records自体のRLSと同じ条件
--        （本人 or 承認済みフォロー）を判定する。
--    ・書き込み（アップロード・削除）：自分のフォルダ（{自分のuser_id}/…）
--      配下だけ。records同様、匿名ユーザーも記録作成に写真が必須（§5）
--      なので、アバターと違いここでは is_anonymous による制限はしない。
--
--    ※ storage.objects はSupabase側で既にRLSが有効なので、
--      enable row level security は実行しないこと。
-- ─────────────────────────────────────────────

drop policy if exists "record_photos_select_owner_or_follower" on storage.objects;
create policy "record_photos_select_owner_or_follower" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'record-photos'
    and exists (
      select 1 from public.records r
      where r.image = storage.objects.name
        and (
          r.user_id = auth.uid()
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followee_id = r.user_id
              and f.status = 'accepted'
          )
        )
    )
  );

drop policy if exists "record_photos_insert_own" on storage.objects;
create policy "record_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "record_photos_delete_own" on storage.objects;
create policy "record_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新（UPDATE）ポリシーは無し：パスは毎回新規のランダムなuuidで発行し、
-- 既存パスへの上書きは行わない運用のため不要。
