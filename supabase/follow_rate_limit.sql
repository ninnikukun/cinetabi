-- ═══════════════════════════════════════════════════════════════
-- シネたび セキュリティ監査対応：request_follow RPCの呼び出し頻度制限
-- （docs/SECURITY_AUDIT.md 項目8）
-- stage2_follows.sql / stage2_follows_fix1.sql 実行済みの環境に、
-- 追加でこの全文を実行してください（両方の内容を引き継いだ形で
-- request_follow を置き換えます）。何度実行しても安全です。
-- ═══════════════════════════════════════════════════════════════

-- 背景：
--   request_follow はID・表示名が一致しない限り常に同じ not_found を返す設計に
--   なっており、片方だけの正誤を外部から判別できない（列挙攻撃への対策済み）。
--   ただし呼び出し自体の頻度は制限されていなかったため、大量呼び出しによる
--   総当たり試行やDB負荷を防ぐ簡易的なレート制限を追加する。

-- ─────────────────────────────────────────────
-- 1) 試行記録テーブル
--    ・RPC（security definer）からのみ書き込む。クライアントに権限は与えない
--    ・RLSを有効にし、ポリシーを一切作らないことで「万一権限が付与されても
--      既定で全拒否」になるようにしておく
-- ─────────────────────────────────────────────
create table if not exists public.follow_request_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

alter table public.follow_request_attempts enable row level security;
revoke all on table public.follow_request_attempts from anon, authenticated;

create index if not exists follow_request_attempts_user_time_idx
  on public.follow_request_attempts (user_id, attempted_at);

-- ─────────────────────────────────────────────
-- 2) request_follow を置き換え：直近1分間に10回を超える試行はブロック
--    （stage2_follows_fix1.sql の内容＝匿名ユーザー除外・相手が匿名の場合の
--     not_found化はそのまま維持し、レート制限のチェックを先頭に追加）
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

  -- レート制限：古い記録を掃除してから直近1分間の試行回数を数える
  delete from public.follow_request_attempts
   where user_id = me and attempted_at < now() - interval '1 minute';

  if (select count(*) from public.follow_request_attempts where user_id = me) >= 10 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.follow_request_attempts (user_id) values (me);

  -- 匿名ユーザー（メール・Google未連携）は申請できない
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'anonymous');
  end if;

  select * into target
    from public.profiles
   where public_id = trim(target_public_id)
     and display_name = trim(target_name);

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- 相手が匿名のうちはフォロー対象にしない（存在も明かさず not_found を返す）
  if exists (select 1 from auth.users u where u.id = target.id and u.is_anonymous) then
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
