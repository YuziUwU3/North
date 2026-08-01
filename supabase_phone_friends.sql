-- 小手机好友 / 群聊基础版
-- 在 Supabase SQL Editor 执行一次即可。
-- 安全模型：公开的小手机ID只用于搜索；写入/发消息必须同时带本机 secret。

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists phone_friend_profiles (
  phone_id text primary key,
  secret_hash text not null,
  display_name text not null default '小手机用户',
  avatar text not null default '🙂',
  allow_search boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phone_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  to_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_id, to_id)
);

create table if not exists phone_friend_messages (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  to_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists phone_friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  name text not null default '小手机群聊',
  created_at timestamptz not null default now()
);

create table if not exists phone_friend_group_members (
  group_id uuid not null references phone_friend_groups(id) on delete cascade,
  phone_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, phone_id)
);

create table if not exists phone_friend_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references phone_friend_groups(id) on delete cascade,
  from_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists phone_friend_message_receipts (
  message_id uuid primary key references phone_friend_messages(id) on delete cascade,
  receiver_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  received_at timestamptz not null default now()
);

create table if not exists phone_friend_group_message_receipts (
  message_id uuid not null references phone_friend_group_messages(id) on delete cascade,
  receiver_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  received_at timestamptz not null default now(),
  primary key (message_id, receiver_id)
);

create table if not exists phone_friend_message_recalls (
  message_id uuid primary key,
  scope text not null default 'friend' check (scope in ('friend','group')),
  actor_id text not null references phone_friend_profiles(phone_id) on delete cascade,
  recalled_at timestamptz not null default now()
);

alter table phone_friend_profiles enable row level security;
alter table phone_friend_requests enable row level security;
alter table phone_friend_messages enable row level security;
alter table phone_friend_groups enable row level security;
alter table phone_friend_group_members enable row level security;
alter table phone_friend_group_messages enable row level security;
alter table phone_friend_message_receipts enable row level security;
alter table phone_friend_group_message_receipts enable row level security;
alter table phone_friend_message_recalls enable row level security;

create or replace function phone_friend_hash(p_secret text)
returns text language sql immutable as $$
  select encode(extensions.digest(convert_to(coalesce(p_secret,''), 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function phone_friend_check(p_phone_id text, p_secret text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from phone_friend_profiles
    where phone_id = upper(trim(p_phone_id))
      and secret_hash = phone_friend_hash(p_secret)
  )
$$;

create or replace function phone_friend_upsert_profile(
  p_phone_id text,
  p_secret text,
  p_display_name text,
  p_avatar text,
  p_allow_search boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id text := upper(trim(p_phone_id));
  v_hash text := phone_friend_hash(p_secret);
begin
  if v_id !~ '^SP[A-Z0-9]{8}$' then
    raise exception 'invalid-phone-id';
  end if;
  if coalesce(p_secret,'') = '' then
    raise exception 'missing-secret';
  end if;

  insert into phone_friend_profiles(phone_id, secret_hash, display_name, avatar, allow_search, updated_at)
  values (v_id, v_hash, left(coalesce(p_display_name,'小手机用户'),40), left(coalesce(p_avatar,'🙂'),60000), coalesce(p_allow_search,true), now())
  on conflict (phone_id) do update set
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    allow_search = excluded.allow_search,
    updated_at = now()
  where phone_friend_profiles.secret_hash = v_hash;

  if not found and exists(select 1 from phone_friend_profiles where phone_id = v_id and secret_hash <> v_hash) then
    raise exception 'phone-id-already-owned';
  end if;

  return true;
end $$;

create or replace function phone_friend_search(p_query text)
returns table(phone_id text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.phone_id, p.display_name, p.avatar
  from phone_friend_profiles p
  where p.allow_search = true
    and p.phone_id = upper(trim(p_query))
  limit 10
$$;

create or replace function phone_friend_are_friends(a text, b text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from phone_friend_requests r
    where r.status = 'accepted'
      and ((r.from_id = upper(trim(a)) and r.to_id = upper(trim(b)))
        or (r.from_id = upper(trim(b)) and r.to_id = upper(trim(a))))
  )
$$;

create or replace function phone_friend_send_request(
  p_from_id text,
  p_secret text,
  p_to_id text,
  p_message text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_from text := upper(trim(p_from_id));
  v_to text := upper(trim(p_to_id));
  v_id uuid;
begin
  if not phone_friend_check(v_from, p_secret) then raise exception 'bad-secret'; end if;
  if v_from = v_to then raise exception 'cannot-add-yourself'; end if;
  if not exists(select 1 from phone_friend_profiles where phone_id = v_to and allow_search = true) then
    raise exception 'user-not-found';
  end if;

  update phone_friend_requests
  set status = 'accepted', updated_at = now()
  where from_id = v_to and to_id = v_from and status = 'pending'
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_id
  from phone_friend_requests
  where status = 'accepted'
    and ((from_id = v_from and to_id = v_to) or (from_id = v_to and to_id = v_from))
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into phone_friend_requests(from_id, to_id, status, message, updated_at)
  values (v_from, v_to, 'pending', left(coalesce(p_message,''),120), now())
  on conflict (from_id, to_id) do update set status = 'pending', message = excluded.message, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function phone_friend_respond_request(
  p_to_id text,
  p_secret text,
  p_request_id uuid,
  p_accept boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_to text := upper(trim(p_to_id));
  v_from text;
  v_status text;
begin
  if not phone_friend_check(v_to, p_secret) then raise exception 'bad-secret'; end if;

  select r.from_id, r.status into v_from, v_status
  from phone_friend_requests r
  where r.id = p_request_id and r.to_id = v_to
  for update;

  if v_from is null then return false; end if;

  if v_status <> 'pending' then
    return (p_accept and v_status = 'accepted') or (not p_accept and v_status = 'rejected');
  end if;

  update phone_friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = p_request_id and to_id = v_to;

  if p_accept then
    update phone_friend_requests
    set status = 'accepted', updated_at = now()
    where from_id = v_to and to_id = v_from and status = 'pending';
  end if;

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

create or replace function phone_friend_create_group(
  p_owner_id text,
  p_secret text,
  p_name text,
  p_member_ids text[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner text := upper(trim(p_owner_id));
  v_group uuid;
  v_mid text;
begin
  if not phone_friend_check(v_owner, p_secret) then raise exception 'bad-secret'; end if;

  insert into phone_friend_groups(owner_id, name)
  values (v_owner, left(coalesce(nullif(trim(p_name),''),'小手机群聊'),40))
  returning id into v_group;

  insert into phone_friend_group_members(group_id, phone_id, role)
  values (v_group, v_owner, 'owner');

  foreach v_mid in array coalesce(p_member_ids, array[]::text[]) loop
    v_mid := upper(trim(v_mid));
    if v_mid <> v_owner and phone_friend_are_friends(v_owner, v_mid) then
      insert into phone_friend_group_members(group_id, phone_id, role)
      values (v_group, v_mid, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return jsonb_build_object('group_id', v_group, 'name', (select name from phone_friend_groups where id = v_group));
end $$;

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

  if exists(select 1 from phone_friend_messages where id = p_message_id and to_id = v_id) then
    insert into phone_friend_message_receipts(message_id, receiver_id, received_at)
    values (p_message_id, v_id, now())
    on conflict (message_id) do update set receiver_id = excluded.receiver_id, received_at = excluded.received_at;
    return true;
  end if;

  if exists(
    select 1
    from phone_friend_group_messages gm
    join phone_friend_group_members mine on mine.group_id = gm.group_id and mine.phone_id = v_id
    where gm.id = p_message_id and gm.from_id <> v_id
  ) then
    insert into phone_friend_group_message_receipts(message_id, receiver_id, received_at)
    values (p_message_id, v_id, now())
    on conflict (message_id, receiver_id) do update set received_at = excluded.received_at;
    return true;
  end if;

  raise exception 'not-message-receiver';
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

grant execute on function phone_friend_upsert_profile(text,text,text,text,boolean) to anon, authenticated;
grant execute on function phone_friend_search(text) to anon, authenticated;
grant execute on function phone_friend_send_request(text,text,text,text) to anon, authenticated;
grant execute on function phone_friend_respond_request(text,text,uuid,boolean) to anon, authenticated;
grant execute on function phone_friend_send_message(text,text,text,text) to anon, authenticated;
grant execute on function phone_friend_create_group(text,text,text,text[]) to anon, authenticated;
grant execute on function phone_friend_group_add_members(text,text,uuid,text[]) to anon, authenticated;
grant execute on function phone_friend_delete_friend(text,text,text) to anon, authenticated;
grant execute on function phone_friend_send_group_message(text,text,uuid,text) to anon, authenticated;
grant execute on function phone_friend_mark_received(text,text,uuid) to anon, authenticated;
grant execute on function phone_friend_recall_message(text,text,uuid) to anon, authenticated;
grant execute on function phone_friend_sync(text,text,bigint) to anon, authenticated;
