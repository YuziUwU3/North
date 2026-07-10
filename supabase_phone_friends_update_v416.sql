-- 小手机好友 v416 补丁：
-- 1. 群聊邀请改为“邀请卡片 -> 对方同意 -> 加入群聊”
-- 2. phone_friend_sync 返回好友 updated_at，前端可显示在线/离线

create table if not exists phone_friend_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references phone_friend_groups(id) on delete cascade,
  inviter_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  invitee_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists phone_friend_group_invites_one
  on phone_friend_group_invites(group_id, invitee_id);

alter table phone_friend_group_invites enable row level security;

create or replace function phone_friend_group_invite(
  p_phone_id text,
  p_secret text,
  p_group_id uuid,
  p_invitee_ids text[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me text := upper(trim(p_phone_id));
  v_mid text;
  v_row jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  if not phone_friend_check(v_me, p_secret) then raise exception 'bad-secret'; end if;
  if not exists(select 1 from phone_friend_group_members where group_id = p_group_id and phone_id = v_me) then
    raise exception 'not-group-member';
  end if;

  foreach v_mid in array coalesce(p_invitee_ids, array[]::text[]) loop
    v_mid := upper(trim(v_mid));
    if v_mid <> v_me
      and phone_friend_are_friends(v_me, v_mid)
      and not exists(select 1 from phone_friend_group_members where group_id = p_group_id and phone_id = v_mid)
    then
      insert into phone_friend_group_invites(group_id, inviter_id, invitee_id, status, updated_at)
      values (p_group_id, v_me, v_mid, 'pending', now())
      on conflict (group_id, invitee_id) do update set
        inviter_id = excluded.inviter_id,
        status = 'pending',
        updated_at = now()
      returning jsonb_build_object(
        'id', id,
        'group_id', group_id,
        'inviter_id', inviter_id,
        'invitee_id', invitee_id,
        'status', status
      ) into v_row;
      v_out := v_out || jsonb_build_array(v_row);
    end if;
  end loop;
  return v_out;
end $$;

create or replace function phone_friend_group_accept_invite(
  p_phone_id text,
  p_secret text,
  p_invite_id uuid,
  p_accept boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me text := upper(trim(p_phone_id));
  v_inv phone_friend_group_invites%rowtype;
begin
  if not phone_friend_check(v_me, p_secret) then raise exception 'bad-secret'; end if;

  select * into v_inv
  from phone_friend_group_invites
  where id = p_invite_id and invitee_id = v_me and status = 'pending';
  if not found then raise exception 'invite-not-found'; end if;

  if coalesce(p_accept,true) then
    insert into phone_friend_group_members(group_id, phone_id, role)
    values (v_inv.group_id, v_me, 'member')
    on conflict do nothing;
    update phone_friend_group_invites set status = 'accepted', updated_at = now() where id = p_invite_id;
  else
    update phone_friend_group_invites set status = 'declined', updated_at = now() where id = p_invite_id;
  end if;

  return jsonb_build_object('group_id', v_inv.group_id, 'accepted', coalesce(p_accept,true));
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
        'updated_at', p.updated_at,
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
          select jsonb_agg(jsonb_build_object('phone_id', p.phone_id, 'display_name', p.display_name, 'avatar', p.avatar, 'updated_at', p.updated_at) order by gm.joined_at)
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
        'message_id', x.message_id,
        'receiver_id', x.receiver_id,
        'received_at', x.received_at,
        'scope', x.scope
      ) order by x.received_at)
      from (
        select r.message_id, r.receiver_id, r.received_at, 'friend'::text as scope
        from phone_friend_message_receipts r
        join phone_friend_messages m on m.id = r.message_id
        where (m.from_id = v_id or m.to_id = v_id) and r.received_at >= v_since
        union all
        select r.message_id, r.receiver_id, r.received_at, 'group'::text as scope
        from phone_friend_group_message_receipts r
        join phone_friend_group_messages gm on gm.id = r.message_id
        join phone_friend_group_members mine on mine.group_id = gm.group_id and mine.phone_id = v_id
        where r.received_at >= v_since
      ) x
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

grant execute on function phone_friend_group_invite(text,text,uuid,text[]) to anon, authenticated;
grant execute on function phone_friend_group_accept_invite(text,text,uuid,boolean) to anon, authenticated;
grant execute on function phone_friend_sync(text,text,bigint) to anon, authenticated;
