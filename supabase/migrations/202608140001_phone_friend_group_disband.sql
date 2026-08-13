-- Only the verified owner may permanently disband a real small-phone group.
-- Deleting the group cascades to members, invitations, messages and receipts.
create or replace function public.phone_friend_group_disband(
  p_owner_id text,
  p_secret text,
  p_group_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text := upper(trim(p_owner_id));
begin
  if not public.phone_friend_check(v_owner, p_secret) then
    raise exception 'bad-secret';
  end if;

  perform 1
  from public.phone_friend_groups
  where id = p_group_id
    and owner_id = v_owner
  for update;
  if not found then
    raise exception 'owner-only';
  end if;

  -- Recall records intentionally have no message foreign key, so remove the
  -- group's recall markers before the message cascade runs.
  delete from public.phone_friend_message_recalls recalls
  using public.phone_friend_group_messages messages
  where recalls.scope = 'group'
    and recalls.message_id = messages.id
    and messages.group_id = p_group_id;

  delete from public.phone_friend_groups
  where id = p_group_id
    and owner_id = v_owner;

  return found;
end
$$;

revoke all on function public.phone_friend_group_disband(text,text,uuid) from public;
grant execute on function public.phone_friend_group_disband(text,text,uuid) to anon, authenticated;
