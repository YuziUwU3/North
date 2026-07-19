-- 小手机好友 v584 补丁：
-- 群主可移出普通群成员；成员身份与群主身份都在云端校验。

create or replace function phone_friend_group_remove_member(
  p_owner_id text,
  p_secret text,
  p_group_id uuid,
  p_member_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_owner text := upper(trim(p_owner_id));
  v_member text := upper(trim(p_member_id));
  v_removed boolean := false;
begin
  if not phone_friend_check(v_owner, p_secret) then raise exception 'bad-secret'; end if;
  if v_member = v_owner then raise exception 'owner-cannot-remove-self'; end if;
  if not exists(
    select 1 from phone_friend_groups
    where id = p_group_id and owner_id = v_owner
  ) then
    raise exception 'owner-only';
  end if;

  delete from phone_friend_group_members
  where group_id = p_group_id and phone_id = v_member;
  v_removed := found;

  update phone_friend_group_invites
  set status = 'declined', updated_at = now()
  where group_id = p_group_id
    and invitee_id = v_member
    and status = 'pending';

  return v_removed;
end $$;

grant execute on function phone_friend_group_remove_member(text,text,uuid,text) to anon, authenticated;
