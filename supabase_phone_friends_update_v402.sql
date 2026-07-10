-- 小手机好友 v402 补丁：
-- 1. 已有群聊可以继续邀请好友进群
-- 2. 通讯录里可以删除小手机好友

create or replace function phone_friend_group_add_members(
  p_owner_id text,
  p_secret text,
  p_group_id uuid,
  p_member_ids text[]
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_owner text := upper(trim(p_owner_id));
  v_mid text;
begin
  if not phone_friend_check(v_owner, p_secret) then raise exception 'bad-secret'; end if;
  if not exists(select 1 from phone_friend_group_members where group_id = p_group_id and phone_id = v_owner) then
    raise exception 'not-group-member';
  end if;

  foreach v_mid in array coalesce(p_member_ids, array[]::text[]) loop
    v_mid := upper(trim(v_mid));
    if v_mid <> v_owner and phone_friend_are_friends(v_owner, v_mid) then
      insert into phone_friend_group_members(group_id, phone_id, role)
      values (p_group_id, v_mid, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return true;
end $$;

create or replace function phone_friend_delete_friend(
  p_phone_id text,
  p_secret text,
  p_friend_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_me text := upper(trim(p_phone_id));
  v_friend text := upper(trim(p_friend_id));
begin
  if not phone_friend_check(v_me, p_secret) then raise exception 'bad-secret'; end if;

  delete from phone_friend_messages
  where (from_id = v_me and to_id = v_friend) or (from_id = v_friend and to_id = v_me);

  delete from phone_friend_requests
  where (from_id = v_me and to_id = v_friend) or (from_id = v_friend and to_id = v_me);

  return true;
end $$;

grant execute on function phone_friend_group_add_members(text,text,uuid,text[]) to anon, authenticated;
grant execute on function phone_friend_delete_friend(text,text,text) to anon, authenticated;
