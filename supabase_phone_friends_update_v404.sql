-- Phone friends v404 patch:
-- Allow packed friend/group messages such as custom stickers to survive sync.

create or replace function phone_friend_send_message(
  p_from_id text,
  p_secret text,
  p_to_id text,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text := upper(trim(p_from_id));
  v_to text := upper(trim(p_to_id));
  v_msg phone_friend_messages%rowtype;
begin
  if not phone_friend_check(v_from, p_secret) then raise exception 'bad-secret'; end if;
  if not phone_friend_are_friends(v_from, v_to) then raise exception 'not-friends'; end if;
  if length(trim(coalesce(p_body,''))) = 0 then raise exception 'empty-message'; end if;

  insert into phone_friend_messages(from_id, to_id, body)
  values (v_from, v_to, left(trim(p_body),60000))
  returning * into v_msg;

  return jsonb_build_object('id', v_msg.id, 'from_id', v_msg.from_id, 'to_id', v_msg.to_id, 'body', v_msg.body, 'created_at', v_msg.created_at);
end $$;

create or replace function phone_friend_send_group_message(
  p_from_id text,
  p_secret text,
  p_group_id uuid,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text := upper(trim(p_from_id));
  v_msg phone_friend_group_messages%rowtype;
begin
  if not phone_friend_check(v_from, p_secret) then raise exception 'bad-secret'; end if;
  if not exists(select 1 from phone_friend_group_members where group_id = p_group_id and phone_id = v_from) then
    raise exception 'not-group-member';
  end if;
  if length(trim(coalesce(p_body,''))) = 0 then raise exception 'empty-message'; end if;

  insert into phone_friend_group_messages(group_id, from_id, body)
  values (p_group_id, v_from, left(trim(p_body),60000))
  returning * into v_msg;

  return jsonb_build_object('id', v_msg.id, 'group_id', v_msg.group_id, 'from_id', v_msg.from_id, 'body', v_msg.body, 'created_at', v_msg.created_at);
end $$;

grant execute on function phone_friend_send_message(text,text,text,text) to anon, authenticated;
grant execute on function phone_friend_send_group_message(text,text,uuid,text) to anon, authenticated;
