-- ═══════════════════════════════════════════════════════════════
-- シネたび：records.thumbnail 列の追加（一覧取得の軽量化）
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / 冪等な書き方にしています。
-- ═══════════════════════════════════════════════════════════════

-- 背景：
--   これまで記録一覧は records.* を丸ごと取得しており、フルサイズの写真
--   （image列、base64のdata URL）も毎回読み込んでいた。一覧では小さい
--   サムネイルだけで十分なため、専用の thumbnail 列を追加し、一覧取得の
--   SELECT文はこちらだけを見るようにする（image列はアプリ側で記録の
--   詳細画面を開いた時だけ個別に取得する）。
--
--   既存データの補完（image はあるが thumbnail が無い記録へのサムネイル
--   生成）は、SQLだけでは行えない（画像のリサイズにブラウザのcanvasを
--   使うため）。アプリ側で、本人がログインした時に裏で自動的に補完する
--   実装にしている（各ユーザーが次に開いた時点で、そのユーザー自身の
--   記録から順次埋まっていく）。

alter table public.records
  add column if not exists thumbnail text;

-- image列と同様、サーバー側でもサイズ・形式の上限を設けておく
-- （records_image_guard.sqlのimage列チェックと同じ考え方。サムネイルは
-- 長辺240px程度に縮小したものなので、上限はimageよりかなり小さくてよい）。
alter table public.records
  drop constraint if exists records_thumbnail_size_check;

alter table public.records
  add constraint records_thumbnail_size_check
  check (
    thumbnail is null
    or (
      length(thumbnail) <= 200000
      and thumbnail like 'data:image/%'
    )
  );
