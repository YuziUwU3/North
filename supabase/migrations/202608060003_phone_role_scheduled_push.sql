create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.phone_role_push_profiles (
  target text not null references public.phone_companion_links(target) on delete cascade,
  role_id text not null,
  role_name text not null default '角色',
  relation text not null default '',
  persona text not null default '',
  user_name text not null default '你',
  enabled boolean not null default false,
  timezone text not null default 'Asia/Shanghai',
  start_hour smallint not null default 9 check (start_hour between 0 and 23),
  end_hour smallint not null default 23 check (end_hour between 0 and 23),
  daily_limit smallint not null default 2 check (daily_limit between 1 and 24),
  idle_minutes integer not null default 120 check (idle_minutes between 15 and 1440),
  next_due_at timestamptz,
  daily_day date,
  daily_count smallint not null default 0,
  claimed_until timestamptz,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (target, role_id)
);

create table if not exists public.phone_role_push_outbox (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_companion_links(target) on delete cascade,
  role_id text not null,
  role_name text not null,
  body text not null,
  trigger_kind text not null default 'scheduled',
  dedupe_key text not null unique,
  push_status text not null default 'queued',
  push_error text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists phone_role_push_due_idx
  on public.phone_role_push_profiles(next_due_at)
  where enabled = true;
create index if not exists phone_role_push_outbox_target_idx
  on public.phone_role_push_outbox(target, created_at desc)
  where consumed_at is null;

alter table public.phone_role_push_profiles enable row level security;
alter table public.phone_role_push_outbox enable row level security;
revoke all on public.phone_role_push_profiles from public, anon, authenticated;
revoke all on public.phone_role_push_outbox from public, anon, authenticated;

create or replace function public.phone_role_push_upsert_profile(
  p_target text,
  p_owner_secret text,
  p_profile jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_role_id text := left(trim(coalesce(p_profile->>'roleId', '')), 120);
  v_enabled boolean := coalesce((p_profile->>'enabled')::boolean, false);
  v_idle integer := greatest(15, least(1440, coalesce((p_profile->>'idleMinutes')::integer, 120)));
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return false; end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;

  insert into public.phone_role_push_profiles (
    target, role_id, role_name, relation, persona, user_name, enabled, timezone,
    start_hour, end_hour, daily_limit, idle_minutes, next_due_at, updated_at
  ) values (
    v_target,
    v_role_id,
    left(trim(coalesce(p_profile->>'roleName', '角色')), 40),
    left(trim(coalesce(p_profile->>'relation', '')), 80),
    left(trim(coalesce(p_profile->>'persona', '')), 1200),
    left(trim(coalesce(p_profile->>'userName', '你')), 40),
    v_enabled,
    case when coalesce(p_profile->>'timezone', '') ~ '^[A-Za-z0-9_+/:.-]{1,64}$'
      then p_profile->>'timezone' else 'Asia/Shanghai' end,
    greatest(0, least(23, coalesce((p_profile->>'startHour')::integer, 9))),
    greatest(0, least(23, coalesce((p_profile->>'endHour')::integer, 23))),
    greatest(1, least(24, coalesce((p_profile->>'dailyLimit')::integer, 2))),
    v_idle,
    case when v_enabled then now() + make_interval(mins => v_idle) else null end,
    now()
  )
  on conflict (target, role_id) do update set
    role_name = excluded.role_name,
    relation = excluded.relation,
    persona = excluded.persona,
    user_name = excluded.user_name,
    enabled = excluded.enabled,
    timezone = excluded.timezone,
    start_hour = excluded.start_hour,
    end_hour = excluded.end_hour,
    daily_limit = excluded.daily_limit,
    idle_minutes = excluded.idle_minutes,
    next_due_at = case
      when not excluded.enabled then null
      when phone_role_push_profiles.enabled
       and phone_role_push_profiles.next_due_at > now()
        then phone_role_push_profiles.next_due_at
      else excluded.next_due_at
    end,
    claimed_until = null,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.phone_role_push_disable_profile(
  p_target text,
  p_owner_secret text,
  p_role_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return false; end if;
  update public.phone_role_push_profiles
  set enabled = false, next_due_at = null, claimed_until = null, updated_at = now()
  where target = trim(p_target) and role_id = left(trim(p_role_id), 120);
  return found;
end;
$$;

create or replace function public.phone_role_push_pull(
  p_target text,
  p_owner_secret text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'roleId', x.role_id, 'roleName', x.role_name,
      'body', x.body, 'triggerKind', x.trigger_kind,
      'pushStatus', x.push_status, 'createdAt', x.created_at
    ) order by x.created_at)
    from (
      select * from public.phone_role_push_outbox
      where target = trim(p_target) and consumed_at is null
      order by created_at asc limit greatest(1, least(50, coalesce(p_limit, 20)))
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.phone_role_push_ack(
  p_target text,
  p_owner_secret text,
  p_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_count integer := 0;
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return 0; end if;
  update public.phone_role_push_outbox set consumed_at = now()
  where target = trim(p_target) and id = any(coalesce(p_ids, array[]::uuid[])) and consumed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.phone_role_push_claim_due(p_limit integer default 20)
returns setof public.phone_role_push_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with due as (
    select p.target, p.role_id
    from public.phone_role_push_profiles p
    where p.enabled = true
      and p.next_due_at <= now()
      and (p.claimed_until is null or p.claimed_until < now())
    order by p.next_due_at asc
    for update skip locked
    limit greatest(1, least(100, coalesce(p_limit, 20)))
  )
  update public.phone_role_push_profiles p
  set claimed_until = now() + interval '2 minutes', updated_at = now()
  from due d
  where p.target = d.target and p.role_id = d.role_id
  returning p.*;
end;
$$;

revoke all on function public.phone_role_push_upsert_profile(text, text, jsonb) from public;
revoke all on function public.phone_role_push_disable_profile(text, text, text) from public;
revoke all on function public.phone_role_push_pull(text, text, integer) from public;
revoke all on function public.phone_role_push_ack(text, text, uuid[]) from public;
revoke all on function public.phone_role_push_claim_due(integer) from public;
grant execute on function public.phone_role_push_upsert_profile(text, text, jsonb) to anon, authenticated;
grant execute on function public.phone_role_push_disable_profile(text, text, text) to anon, authenticated;
grant execute on function public.phone_role_push_pull(text, text, integer) to anon, authenticated;
grant execute on function public.phone_role_push_ack(text, text, uuid[]) to anon, authenticated;
grant execute on function public.phone_role_push_claim_due(integer) to service_role;

do $$
declare v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'phone-role-push-every-minute' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'phone-role-push-every-minute',
    '* * * * *',
    $cron$select net.http_post(
      url := 'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-role-push',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"action":"dispatch_due"}'::jsonb,
      timeout_milliseconds := 50000
    );$cron$
  );
end $$;
