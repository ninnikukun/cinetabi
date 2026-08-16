-- ═══════════════════════════════════════════════════════════════
-- シネたび：不適切な投稿の通報機能
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / 冪等な書き方にしています。
--
-- 背景：
--   record_reports は通報者本人のINSERTのみ許可し、SELECT/UPDATEの
--   ポリシーは一切作らない。閲覧・対応済み処理は管理画面（隠しルート
--   ?admin=reports）から /api/admin-reports.js 経由・service_role鍵で
--   行うため、テーブル自体をクライアントに公開する必要が無い
--   （通報された側は自分が通報されたことを一覧取得できない）。
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.record_reports (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.records(id) on delete cascade,
  -- クライアントに値を渡させず常にauth.uid()に固定する（なりすまし防止・実装の単純化）
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason      text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (record_id, reporter_id)
);

alter table public.record_reports enable row level security;

create index if not exists record_reports_resolved_idx on public.record_reports (resolved, created_at);

drop policy if exists "record_reports_insert_own" on public.record_reports;
create policy "record_reports_insert_own" on public.record_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- SELECT/UPDATE/DELETEポリシーは意図的に作らない（service_role専用）。
