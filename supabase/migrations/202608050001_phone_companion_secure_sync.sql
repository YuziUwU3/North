create table if not exists public.phone_companion_links (
  target text primary key,
  owner_secret_hash text not null,
  device_secret_hash text,
  device_id text,
  device_name text,
  pair_code_hash text,
  pair_expires_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  paired_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_companion_commands (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_companion_links(target) on delete cascade,
  command jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists phone_companion_commands_pending_idx
  on public.phone_companion_commands (target, status, created_at);

alter table public.phone_companion_links enable row level security;
alter table public.phone_companion_commands enable row level security;

revoke all on table public.phone_companion_links from anon, authenticated;
revoke all on table public.phone_companion_commands from anon, authenticated;

create or replace function public.phone_companion_hash(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(coalesce(p_value, ''), 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.phone_companion_owner_ok(p_target text, p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.phone_companion_links
    where target = trim(coalesce(p_target, ''))
      and owner_secret_hash = public.phone_companion_hash(p_secret)
  )
$$;

create or replace function public.phone_companion_device_ok(p_target text, p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.phone_companion_links
    where target = trim(coalesce(p_target, ''))
      and device_secret_hash is not null
      and device_secret_hash = public.phone_companion_hash(p_secret)
  )
$$;

create or replace function public.phone_companion_begin_pairing(
  p_target text,
  p_owner_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_owner_hash text := public.phone_companion_hash(p_owner_secret);
  v_code text := lpad(floor(random() * 100000000)::bigint::text, 8, '0');
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_target !~ '^yb_[a-z0-9]{20,96}$' then
    raise exception 'invalid-target';
  end if;
  if length(coalesce(p_owner_secret, '')) < 24 then
    raise exception 'weak-owner-secret';
  end if;

  insert into public.phone_companion_links(target, owner_secret_hash, pair_code_hash, pair_expires_at)
  values (v_target, v_owner_hash, public.phone_companion_hash(v_target || ':' || v_code), v_expires)
  on conflict (target) do update
    set pair_code_hash = excluded.pair_code_hash,
        pair_expires_at = excluded.pair_expires_at,
        updated_at = now()
    where public.phone_companion_links.owner_secret_hash = v_owner_hash;

  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then
    raise exception 'owner-secret-mismatch';
  end if;

  return jsonb_build_object(
    'target', v_target,
    'pairCode', v_code,
    'expiresAt', v_expires,
    'alreadyLinked', exists(
      select 1 from public.phone_companion_links
      where target = v_target and device_secret_hash is not null
    )
  );
end;
$$;

create or replace function public.phone_companion_bind_device(
  p_target text,
  p_pair_code text,
  p_device_id text,
  p_device_name text,
  p_device_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_count integer := 0;
begin
  if length(coalesce(p_device_secret, '')) < 24 then
    raise exception 'weak-device-secret';
  end if;
  if length(trim(coalesce(p_device_id, ''))) < 8 then
    raise exception 'invalid-device-id';
  end if;

  update public.phone_companion_links
  set device_secret_hash = public.phone_companion_hash(p_device_secret),
      device_id = left(trim(p_device_id), 160),
      device_name = left(coalesce(nullif(trim(p_device_name), ''), 'iPhone'), 80),
      pair_code_hash = null,
      pair_expires_at = null,
      paired_at = now(),
      updated_at = now()
  where target = v_target
    and pair_expires_at >= now()
    and pair_code_hash = public.phone_companion_hash(v_target || ':' || trim(coalesce(p_pair_code, '')));

  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.phone_companion_push_snapshot(
  p_target text,
  p_device_secret text,
  p_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  if not public.phone_companion_device_ok(p_target, p_device_secret) then
    return false;
  end if;
  if jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_snapshot) > 524288 then
    raise exception 'invalid-snapshot';
  end if;

  update public.phone_companion_links
  set snapshot = p_snapshot,
      last_sync_at = now(),
      updated_at = now()
  where target = trim(p_target)
    and device_secret_hash = public.phone_companion_hash(p_device_secret);
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.phone_companion_pull_snapshot(
  p_target text,
  p_owner_secret text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row public.phone_companion_links%rowtype;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return null;
  end if;

  select * into v_row
  from public.phone_companion_links
  where target = trim(p_target);

  return jsonb_build_object(
    'linked', v_row.device_secret_hash is not null,
    'deviceId', v_row.device_id,
    'deviceName', v_row.device_name,
    'pairedAt', v_row.paired_at,
    'lastSyncAt', v_row.last_sync_at,
    'snapshot', coalesce(v_row.snapshot, '{}'::jsonb),
    'commands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'status', c.status,
        'result', c.result,
        'acknowledgedAt', c.acknowledged_at
      ) order by c.created_at desc)
      from (
        select *
        from public.phone_companion_commands
        where target = v_row.target
        order by created_at desc
        limit 40
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.phone_companion_enqueue_command(
  p_target text,
  p_owner_secret text,
  p_command jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return null;
  end if;
  if jsonb_typeof(coalesce(p_command, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_command) > 32768 then
    raise exception 'invalid-command';
  end if;

  insert into public.phone_companion_commands(target, command)
  values (trim(p_target), p_command)
  returning id into v_id;

  delete from public.phone_companion_commands
  where target = trim(p_target)
    and created_at < now() - interval '30 days';

  return v_id;
end;
$$;

create or replace function public.phone_companion_pull_commands(
  p_target text,
  p_device_secret text
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when not public.phone_companion_device_ok(p_target, p_device_secret) then null
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'command', command,
        'createdAt', created_at
      ) order by created_at)
      from (
        select id, command, created_at
        from public.phone_companion_commands
        where target = trim(p_target) and status = 'pending'
        order by created_at
        limit 20
      ) pending
    ), '[]'::jsonb)
  end
$$;

create or replace function public.phone_companion_ack_command(
  p_target text,
  p_device_secret text,
  p_command_id uuid,
  p_ok boolean,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  if not public.phone_companion_device_ok(p_target, p_device_secret) then
    return false;
  end if;

  update public.phone_companion_commands
  set status = case when coalesce(p_ok, false) then 'completed' else 'failed' end,
      result = case when jsonb_typeof(coalesce(p_result, '{}'::jsonb)) = 'object' then p_result else '{}'::jsonb end,
      acknowledged_at = now()
  where id = p_command_id and target = trim(p_target) and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.phone_companion_hash(text) from public;
revoke all on function public.phone_companion_owner_ok(text, text) from public;
revoke all on function public.phone_companion_device_ok(text, text) from public;
revoke all on function public.phone_companion_begin_pairing(text, text) from public;
revoke all on function public.phone_companion_bind_device(text, text, text, text, text) from public;
revoke all on function public.phone_companion_push_snapshot(text, text, jsonb) from public;
revoke all on function public.phone_companion_pull_snapshot(text, text) from public;
revoke all on function public.phone_companion_enqueue_command(text, text, jsonb) from public;
revoke all on function public.phone_companion_pull_commands(text, text) from public;
revoke all on function public.phone_companion_ack_command(text, text, uuid, boolean, jsonb) from public;

grant execute on function public.phone_companion_begin_pairing(text, text) to anon, authenticated;
grant execute on function public.phone_companion_bind_device(text, text, text, text, text) to anon, authenticated;
grant execute on function public.phone_companion_push_snapshot(text, text, jsonb) to anon, authenticated;
grant execute on function public.phone_companion_pull_snapshot(text, text) to anon, authenticated;
grant execute on function public.phone_companion_enqueue_command(text, text, jsonb) to anon, authenticated;
grant execute on function public.phone_companion_pull_commands(text, text) to anon, authenticated;
grant execute on function public.phone_companion_ack_command(text, text, uuid, boolean, jsonb) to anon, authenticated;
