-- Phone friends v405 patch.
-- Includes v402/v404 compatibility plus:
-- 1. friend/group message recall
-- 2. direct friend transfer/redpacket receive receipts

create table if not exists phone_friend_message_receipts (
  message_id uuid primary key references phone_friend_messages(id) on delete cascade,
  receiver_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  received_at timestamptz not null default now()
);

create table if not exists phone_friend_message_recalls (
  message_id uuid primary key,
  scope text not null default 'friend' check (scope in ('friend','group')),
  actor_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  recalled_at timestamptz not null default now()
);

alter table phone_friend_message_receipts enable row level security;
alter table phone_friend_message_recalls enable row level security;

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

create or replace function phone_friend_mark_received(
  p_phone_id text,
  p_secret text,
  p_message_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id text := upper(trim(p_phone_id));
begin
  if not phone_friend_check(v_id, p_secret) then raise exception 'bad-secret'; end if;
  if not exists(select 1 from phone_friend_messages where id = p_message_id and to_id = v_id) then
    raise exception 'not-message-receiver';
  end if;

  insert into phone_friend_message_receipts(message_id, receiver_id, received_at)
  values (p_message_id, v_id, now())
  on conflict (message_id) do update set receiver_id = excluded.receiver_id, received_at = excluded.received_at;

  return true;
end $$;

create or replace function phone_friend_recall_message(
  p_phone_id text,
  p_secret text,
  p_message_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id text := upper(trim(p_phone_id));
  v_scope text := null;
begin
  if not phone_friend_check(v_id, p_secret) then raise exception 'bad-secret'; end if;

  if exists(select 1 from phone_friend_messages where id = p_message_id and from_id = v_id) then
    v_scope := 'friend';
  elsif exists(
    select 1
    from phone_friend_group_messages gm
    join phone_friend_group_members mine on mine.group_id = gm.group_id and mine.phone_id = v_id
    where gm.id = p_message_id and gm.from_id = v_id
  ) then
    v_scope := 'group';
  end if;

  if v_scope is null then raise exception 'not-message-sender'; end if;

  insert into phone_friend_message_recalls(message_id, scope, actor_id, recalled_at)
  values (p_message_id, v_scope, v_id, now())
  on conflict (message_id) do update set actor_id = excluded.actor_id, recalled_at = excluded.recalled_at;

  return true;
end $$;

create or replace function phone_friend_sync(
  p_phone_id text,
  p_secret text,
  p_since_ms bigint default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id text := upper(trim(p_phone_id));
  v_since timestamptz := to_timestamp(greatest(coalesce(p_since_ms,0),0) / 1000.0);
begin
  if not phone_friend_check(v_id, p_secret) then raise exception 'bad-secret'; end if;

  return jsonb_build_object(
    'server_time_ms', floor(extract(epoch from now()) * 1000),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'phone_id', p.phone_id,
        'display_name', p.display_name,
        'avatar', p.avatar,
        'since', f.since
      ) order by f.since desc)
      from (
        select case when r.from_id = v_id then r.to_id else r.from_id end as other_id,
               max(r.updated_at) as since
        from phone_friend_requests r
        where r.status = 'accepted' and (r.from_id = v_id or r.to_id = v_id)
        group by 1
      ) f
      join phone_friend_profiles p on p.phone_id = f.other_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'direction', case when r.to_id = v_id then 'incoming' else 'outgoing' end,
        'status', r.status,
        'from_id', r.from_id,
        'to_id', r.to_id,
        'from_name', pf.display_name,
        'from_avatar', pf.avatar,
        'to_name', pt.display_name,
        'to_avatar', pt.avatar,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from phone_friend_requests r
      join phone_friend_profiles pf on pf.phone_id = r.from_id
      join phone_friend_profiles pt on pt.phone_id = r.to_id
      where r.status = 'pending' and (r.from_id = v_id or r.to_id = v_id)
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'from_id', m.from_id,
        'to_id', m.to_id,
        'body', m.body,
        'created_at', m.created_at
      ) order by m.created_at)
      from (
        select * from phone_friend_messages
        where (from_id = v_id or to_id = v_id) and created_at >= v_since
        order by created_at desc
        limit 500
      ) m
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id,
        'name', g.name,
        'owner_id', g.owner_id,
        'member_count', (select count(*) from phone_friend_group_members gm2 where gm2.group_id = g.id),
        'members', (
          select jsonb_agg(jsonb_build_object('phone_id', p.phone_id, 'display_name', p.display_name, 'avatar', p.avatar) order by gm.joined_at)
          from phone_friend_group_members gm
          join phone_friend_profiles p on p.phone_id = gm.phone_id
          where gm.group_id = g.id
        )
      ) order by g.created_at desc)
      from phone_friend_groups g
      join phone_friend_group_members mine on mine.group_id = g.id and mine.phone_id = v_id
    ), '[]'::jsonb),
    'group_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'group_id', m.group_id,
        'from_id', m.from_id,
        'body', m.body,
        'created_at', m.created_at
      ) order by m.created_at)
      from (
        select gm.*
        from phone_friend_group_messages gm
        join phone_friend_group_members mine on mine.group_id = gm.group_id and mine.phone_id = v_id
        where gm.created_at >= v_since
        order by gm.created_at desc
        limit 600
      ) m
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id', r.message_id,
        'receiver_id', r.receiver_id,
        'received_at', r.received_at
      ) order by r.received_at)
      from phone_friend_message_receipts r
      join phone_friend_messages m on m.id = r.message_id
      where (m.from_id = v_id or m.to_id = v_id) and r.received_at >= v_since
    ), '[]'::jsonb),
    'recalls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id', r.message_id,
        'scope', r.scope,
        'actor_id', r.actor_id,
        'recalled_at', r.recalled_at
      ) order by r.recalled_at)
      from phone_friend_message_recalls r
      where r.recalled_at >= v_since and (
        (r.scope = 'friend' and exists (
          select 1 from phone_friend_messages m
          where m.id = r.message_id and (m.from_id = v_id or m.to_id = v_id)
        ))
        or
        (r.scope = 'group' and exists (
          select 1
          from phone_friend_group_messages gm
          join phone_friend_group_members mine on mine.group_id = gm.group_id and mine.phone_id = v_id
          where gm.id = r.message_id
        ))
      )
    ), '[]'::jsonb)
  );
end $$;

grant execute on function phone_friend_group_add_members(text,text,uuid,text[]) to anon, authenticated;
grant execute on function phone_friend_delete_friend(text,text,text) to anon, authenticated;
grant execute on function phone_friend_send_message(text,text,text,text) to anon, authenticated;
grant execute on function phone_friend_send_group_message(text,text,uuid,text) to anon, authenticated;
grant execute on function phone_friend_mark_received(text,text,uuid) to anon, authenticated;
grant execute on function phone_friend_recall_message(text,text,uuid) to anon, authenticated;
grant execute on function phone_friend_sync(text,text,bigint) to anon, authenticated;
