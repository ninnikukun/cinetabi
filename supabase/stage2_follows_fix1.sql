-- ═══════════════════════════════════════════════════════════════
-- シネたび ステージ2 修正1：匿名ユーザーはフォロー機能を使えなくする
-- （stage2_follows.sql 実行済みの環境に、追加でこの全文を実行してください）
--
-- ・申請：RPC内で「申請者が匿名なら拒否」をサーバー側で強制
-- ・相手が匿名の場合も not_found を返す（匿名ユーザーは承認できないため、
--   フォロー対象にならない。IDの実在も明かさない）
-- ・承認：RLSポリシー側でも「匿名ユーザーは承認不可」を強制
-- ═══════════════════════════════════════════════════════════════

-- 1) 申請RPC：匿名チェックを追加した版で置き換え
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

-- 2) 承認（statusの更新）も匿名ユーザーには許可しない
drop policy if exists "follows_update_followee" on public.follows;
create policy "follows_update_followee" on public.follows
  for update
  using (
    followee_id = auth.uid()
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  )
  with check (followee_id = auth.uid());
