-- ═══════════════════════════════════════════════════════════════
-- シネたび ステージ2：フォロー機能（DB側）
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行してください。
-- 何度実行しても安全なように if not exists / or replace で書いています。
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) profiles に公開ID（usr_xxxx）を追加
--    ・フォロー申請時に相手へ教えるIDで、これ以外の用途はない
--    ・サーバー側で自動生成（クライアントからは指定不可）
-- ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists public_id text;

-- 既存ユーザーへの発行（未発行の行のみ）
update public.profiles
  set public_id = 'usr_' || substr(md5(gen_random_uuid()::text), 1, 12)
  where public_id is null;

alter table public.profiles
  alter column public_id set not null;
alter table public.profiles
  alter column public_id set default ('usr_' || substr(md5(gen_random_uuid()::text), 1, 12));

create unique index if not exists profiles_public_id_key
  on public.profiles (public_id);

-- ─────────────────────────────────────────────
-- 2) follows テーブル
--    ・1行 ＝「follower（申請者）→ followee（相手）」の片方向の関係
--    ・status: pending（承認待ち）→ accepted（承認済み）
--    ・拒否 ＝ 行の削除（相手には何も通知されず、申請中表示が消えるだけ）
-- ─────────────────────────────────────────────
create table if not exists public.follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted')),
  created_at  timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

-- 自分が当事者（申請した／された）の行だけ見える。
-- これにより「フォロー数・フォロワー数は本人にしか見えない」が自動的に成立する。
drop policy if exists "follows_select_parties" on public.follows;
create policy "follows_select_parties" on public.follows
  for select using (follower_id = auth.uid() or followee_id = auth.uid());

-- INSERT はクライアントから直接させない（下の RPC 経由のみ）。
-- → insert ポリシーを作らず、テーブル権限からも剥がす。
revoke insert on table public.follows from anon, authenticated;

-- 承認：申請を受け取った側だけが更新できる。
-- さらに列単位の権限で「status 列しか更新できない」ように制限
-- （follower_id を書き換えて他人になりすます、等を防ぐ）。
drop policy if exists "follows_update_followee" on public.follows;
create policy "follows_update_followee" on public.follows
  for update using (followee_id = auth.uid()) with check (followee_id = auth.uid());

revoke update on table public.follows from anon, authenticated;
grant update (status) on table public.follows to authenticated;

-- 削除：申請の取り下げ（申請者）／拒否・フォロワー解除（受け取った側）の両方に使う
drop policy if exists "follows_delete_parties" on public.follows;
create policy "follows_delete_parties" on public.follows
  for delete using (follower_id = auth.uid() or followee_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3) profiles の追加ポリシー
--    フォロー関係の当事者どうしは、お互いの表示名を見られるようにする
--    （承認画面で申請者の名前を出す／フォロー中一覧に相手の名前を出すため）。
--    ※ それ以外の他人のプロフィールは今までどおり見えない＝検索不可の設計を維持
-- ─────────────────────────────────────────────
drop policy if exists "profiles_select_follow_parties" on public.profiles;
create policy "profiles_select_follow_parties" on public.profiles
  for select using (
    exists (
      select 1 from public.follows f
      where (f.follower_id = auth.uid() and f.followee_id = profiles.id)
         or (f.followee_id = auth.uid() and f.follower_id = profiles.id)
    )
  );

-- ─────────────────────────────────────────────
-- 4) records の追加ポリシー
--    「承認済みフォロワーは、その人の記録を読める」
--    既存の「本人だけ読み書きできる」ポリシーはそのまま（ポリシーはORで合成される）。
-- ─────────────────────────────────────────────
drop policy if exists "records_select_accepted_followers" on public.records;
create policy "records_select_accepted_followers" on public.records
  for select using (
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.followee_id = records.user_id
        and f.status = 'accepted'
    )
  );

-- ─────────────────────────────────────────────
-- 5) フォロー申請 RPC
--    ・「公開ID と 表示名 の両方が一致」した時だけ申請が作れる
--    ・security definer（サーバー権限）で実行し、チェックをサーバー側で強制する
--    ・IDだけ合っていても名前が違えば同じ not_found を返す
--      → 「このIDは存在するか」を探る総当たりの手がかりを与えない
-- ─────────────────────────────────────────────
create or replace function public.request_follow(target_public_id text, target_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  existing public.follows%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into target
    from public.profiles
   where public_id = trim(target_public_id)
     and display_name = trim(target_name);

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if target.id = me then
    return jsonb_build_object('ok', false, 'code', 'self');
  end if;

  select * into existing
    from public.follows
   where follower_id = me and followee_id = target.id;

  if found then
    return jsonb_build_object('ok', false, 'code',
      case when existing.status = 'accepted' then 'already_following'
           else 'already_requested' end);
  end if;

  insert into public.follows (follower_id, followee_id)
  values (me, target.id)
  on conflict (follower_id, followee_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_follow(text, text) from public, anon;
grant execute on function public.request_follow(text, text) to authenticated;
