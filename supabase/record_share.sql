-- ═══════════════════════════════════════════════════════════════
-- シネたび：記録の共有リンク機能
-- （docs/SECURITY_AUDIT.md 項目3）
--
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / 冪等な書き方にしています。
--
-- 背景：
--   特定の1件の記録だけを、ログイン不要のリンクで外部公開できるようにする。
--   share_token・password_hashは records に直置きせず、別テーブル
--   record_shares に分離する。records の閲覧RLSは行単位のため、直置きすると
--   「承認済みフォロワー（records_select_accepted_followers）」が
--   share_token・password_hashまで見えてしまう（相手はどのみちその記録を
--   見られる立場だが、リンクを転載できてしまう・4桁パスワードのハッシュを
--   オフラインで解析されうる、という点で望ましくない）。
--   record_shares は「本人のみ閲覧・作成可」のRLSにすることでこれを避ける。
--
--   実際のデータ取得・パスワード照合は、service_role鍵を使う
--   /api/share.js（Vercelサーバーレス関数）が行う（RLSをバイパスして
--   非ログインユーザーにも結果を返すため）。したがってこのテーブル自体の
--   SELECTをanon/authenticatedに広く許可する必要は無い。
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) record_shares：公開設定（1記録につき最大1行、非公開に戻す機能は無いため
--    一度作成したら基本的に不変。record_id に unique を張り、
--    「まだ無ければ作る」という運用をクライアント側で行う）
-- ─────────────────────────────────────────────
create table if not exists public.record_shares (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null unique references public.records(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  share_token   uuid not null unique default gen_random_uuid(),
  password_hash text, -- bcryptハッシュ（クライアント側でbcryptjs生成）。null = パスワード不要モード
  created_at    timestamptz not null default now()
);

alter table public.record_shares enable row level security;

create index if not exists record_shares_owner_idx on public.record_shares (owner_id);

drop policy if exists "record_shares_select_own" on public.record_shares;
create policy "record_shares_select_own" on public.record_shares
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "record_shares_insert_own" on public.record_shares;
create policy "record_shares_insert_own" on public.record_shares
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.records r where r.id = record_id and r.user_id = auth.uid())
  );

-- 更新・削除ポリシーは意図的に作らない（非公開に戻す機能は無し。
-- 一覧・詳細画面で「共有中」を出す用途はSELECTのみで足りる）。

-- ─────────────────────────────────────────────
-- 2) record_share_attempts：パスワード照合の試行記録（follow_request_attempts
--    と同じ発想）。/api/share.js が service_role鍵で読み書きするのみで、
--    クライアントに権限は与えない（RLSを有効にしてポリシーを一切作らない
--    ことで、万一権限が付与されても既定で全拒否になるようにしておく）。
-- ─────────────────────────────────────────────
create table if not exists public.record_share_attempts (
  id           uuid primary key default gen_random_uuid(),
  share_token  uuid not null,
  attempted_at timestamptz not null default now()
);

alter table public.record_share_attempts enable row level security;
revoke all on table public.record_share_attempts from anon, authenticated;

create index if not exists record_share_attempts_token_time_idx
  on public.record_share_attempts (share_token, attempted_at);
