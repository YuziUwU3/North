-- Durable background role work, app-awareness flow and server-side companion automations.
-- All work is claimed from the same minute dispatcher so scheduled messages cannot collide.

alter table public.phone_role_push_profiles
  add column if not exists time_aware boolean not null default true,
  add column if not exists app_watch_enabled boolean not null default false,
  add column if not exists app_watch_daily_limit smallint not null default 2,
  add column if not exists app_watch_day date,
  add column if not exists app_watch_count smallint not null default 0,
  add column if not exists automation_config jsonb not null default '{}'::jsonb,
  add column if not exists automation_state jsonb not null default '{}'::jsonb;

create table if not exists public.phone_role_background_tasks (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_companion_links(target) on delete cascade,
  role_id text not null,
  kind text not null check (kind in ('reply_handoff','device_handoff','one_minute_test','app_followup')),
  payload jsonb not null default '{}'::jsonb,
  baseline_user_at timestamptz,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','claimed','completed','canceled','failed')),
  claimed_until timestamptz,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.phone_role_background_tasks
  add column if not exists attempts smallint not null default 0;

create index if not exists phone_role_background_tasks_due_idx
  on public.phone_role_background_tasks(due_at)
  where status = 'pending';

alter table public.phone_role_background_tasks enable row level security;
revoke all on public.phone_role_background_tasks from public, anon, authenticated;

create or replace function public.phone_role_background_enqueue(
  p_target text,
  p_owner_secret text,
  p_role_id text,
  p_kind text,
  p_payload jsonb,
  p_due_ms bigint,
  p_baseline_user_ms bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_target text := trim(coalesce(p_target, ''));
  v_role text := left(trim(coalesce(p_role_id, '')), 120);
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_due timestamptz;
  v_baseline timestamptz;
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return null; end if;
  if v_role = '' or v_kind not in ('reply_handoff','device_handoff','one_minute_test','app_followup') then
    raise exception 'invalid-background-task';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' or pg_column_size(p_payload) > 65536 then
    raise exception 'invalid-background-payload';
  end if;
  v_due := to_timestamp(greatest((extract(epoch from now()) * 1000)::bigint, coalesce(p_due_ms, 0))::numeric / 1000);
  if coalesce(p_baseline_user_ms, 0) > 0 then
    v_baseline := to_timestamp(p_baseline_user_ms::numeric / 1000);
  end if;

  if v_kind in ('reply_handoff','device_handoff') then
    update public.phone_role_background_tasks
       set status = 'canceled', completed_at = now()
     where target = v_target and role_id = v_role
       and kind in ('reply_handoff','device_handoff') and status in ('pending','claimed');
  end if;

  insert into public.phone_role_background_tasks(target, role_id, kind, payload, baseline_user_at, due_at)
  values(v_target, v_role, v_kind, coalesce(p_payload, '{}'::jsonb), v_baseline, v_due)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.phone_role_background_cancel(
  p_target text, p_owner_secret text, p_role_id text, p_kinds text[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_count integer;
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return 0; end if;
  update public.phone_role_background_tasks
     set status = 'canceled', completed_at = now()
   where target = trim(p_target) and role_id = left(trim(p_role_id), 120)
     and status in ('pending','claimed')
     and (p_kinds is null or kind = any(p_kinds));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.phone_role_background_claim_due(p_limit integer default 20)
returns setof public.phone_role_background_tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with picked as (
    select id from public.phone_role_background_tasks
     where (status = 'pending' or (status = 'claimed' and claimed_until < now())) and due_at <= now()
     order by due_at asc
     for update skip locked
     limit greatest(1, least(50, coalesce(p_limit, 20)))
  )
  update public.phone_role_background_tasks t
     set status = 'claimed', claimed_until = now() + interval '2 minutes', attempts = t.attempts + 1
    from picked where t.id = picked.id
  returning t.*;
end;
$$;

revoke all on function public.phone_role_background_enqueue(text,text,text,text,jsonb,bigint,bigint) from public;
revoke all on function public.phone_role_background_cancel(text,text,text,text[]) from public;
revoke all on function public.phone_role_background_claim_due(integer) from public;
grant execute on function public.phone_role_background_enqueue(text,text,text,text,jsonb,bigint,bigint) to anon, authenticated;
grant execute on function public.phone_role_background_cancel(text,text,text,text[]) to anon, authenticated;

create or replace function public.phone_role_cancel_followup_on_user_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.last_user_at is distinct from old.last_user_at and new.last_user_at > coalesce(old.last_user_at, '-infinity'::timestamptz) then
    update public.phone_role_background_tasks
       set status = 'canceled', completed_at = now()
     where target = new.target and role_id = new.role_id
       and kind = 'app_followup' and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists phone_role_cancel_followup_on_user_activity on public.phone_role_push_profiles;
create trigger phone_role_cancel_followup_on_user_activity
after update of last_user_at on public.phone_role_push_profiles
for each row execute function public.phone_role_cancel_followup_on_user_activity();

create or replace function public.phone_role_automation_claim(p_limit integer default 20)
returns setof public.phone_role_push_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with picked as (
    select target, role_id from public.phone_role_push_profiles
     where enabled = true
       and automation_config <> '{}'::jsonb
       and (claimed_until is null or claimed_until < now())
     order by updated_at asc
     for update skip locked
     limit greatest(1, least(50, coalesce(p_limit, 20)))
  )
  update public.phone_role_push_profiles p
     set claimed_until = now() + interval '90 seconds'
    from picked
   where p.target = picked.target and p.role_id = picked.role_id
  returning p.*;
end;
$$;

revoke all on function public.phone_role_automation_claim(integer) from public;

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
  v_idle integer := greatest(0, least(1440, coalesce((p_profile->>'idleMinutes')::integer, 0)));
  v_min integer := greatest(1, least(10, coalesce((p_profile->>'messageMin')::integer, 1)));
  v_max integer;
  v_avatar text := trim(coalesce(p_profile->>'avatarData', ''));
  v_recent text := left(trim(coalesce(p_profile->>'recentContext', '')), 8000);
  v_memory text := left(trim(coalesce(p_profile->>'memoryContext', '')), 16000);
  v_last_activity timestamptz;
  v_quiet_until timestamptz;
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return false; end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;
  v_max := greatest(v_min, least(10, coalesce((p_profile->>'messageMax')::integer, 4)));
  if length(v_avatar) > 50000 or v_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then v_avatar := ''; end if;
  if coalesce(p_profile->>'lastUserAt', '') ~ '^[0-9]{10,16}$' then
    v_last_activity := least(now(), to_timestamp((p_profile->>'lastUserAt')::numeric / 1000));
  end if;
  if coalesce(p_profile->>'quietUntilAt', '') ~ '^[0-9]{10,16}$' then
    v_quiet_until := to_timestamp((p_profile->>'quietUntilAt')::numeric / 1000);
  end if;

  insert into public.phone_role_push_profiles (
    target, role_id, role_name, relation, persona, user_name, avatar_data,
    recent_context, memory_context, last_user_at, enabled, timezone, start_hour, end_hour,
    daily_limit, idle_minutes, message_min, message_max, quiet_until_at, next_due_at,
    time_aware, app_watch_enabled, app_watch_daily_limit, automation_config, updated_at
  ) values (
    v_target, v_role_id, left(trim(coalesce(p_profile->>'roleName', 'Role')), 40),
    left(trim(coalesce(p_profile->>'relation', '')), 80), left(trim(coalesce(p_profile->>'persona', '')), 1200),
    left(trim(coalesce(p_profile->>'userName', 'User')), 40), v_avatar, v_recent, v_memory, v_last_activity,
    v_enabled, case when coalesce(p_profile->>'timezone', '') ~ '^[A-Za-z0-9_+/:.-]{1,64}$' then p_profile->>'timezone' else 'Asia/Shanghai' end,
    0, 0, greatest(1, least(24, coalesce((p_profile->>'dailyLimit')::integer, 2))), v_idle, v_min, v_max,
    v_quiet_until, case when v_enabled then greatest(now(), coalesce(v_last_activity, now()) + make_interval(mins => 30 + floor(random() * 31)::integer)) else null end,
    coalesce((p_profile->>'timeAware')::boolean, true), coalesce((p_profile->>'appWatchEnabled')::boolean, false),
    greatest(0, least(5, coalesce((p_profile->>'appWatchDailyLimit')::integer, 2))),
    coalesce(p_profile->'automationConfig', '{}'::jsonb), now()
  )
  on conflict (target, role_id) do update set
    role_name=excluded.role_name, relation=excluded.relation, persona=excluded.persona, user_name=excluded.user_name,
    avatar_data=excluded.avatar_data,
    recent_context=case when excluded.last_user_at is null or phone_role_push_profiles.last_user_at is null or excluded.last_user_at >= phone_role_push_profiles.last_user_at then excluded.recent_context else phone_role_push_profiles.recent_context end,
    memory_context=case when excluded.last_user_at is null or phone_role_push_profiles.last_user_at is null or excluded.last_user_at >= phone_role_push_profiles.last_user_at then excluded.memory_context else phone_role_push_profiles.memory_context end,
    last_user_at=greatest(phone_role_push_profiles.last_user_at, excluded.last_user_at), enabled=excluded.enabled,
    timezone=excluded.timezone, start_hour=0, end_hour=0, daily_limit=excluded.daily_limit, idle_minutes=excluded.idle_minutes,
    message_min=excluded.message_min, message_max=excluded.message_max, quiet_until_at=excluded.quiet_until_at,
    time_aware=excluded.time_aware, app_watch_enabled=excluded.app_watch_enabled,
    app_watch_daily_limit=excluded.app_watch_daily_limit, automation_config=excluded.automation_config,
    next_due_at=case
      when not excluded.enabled then null
      when excluded.last_user_at is not null and (phone_role_push_profiles.last_user_at is null or excluded.last_user_at > phone_role_push_profiles.last_user_at)
        then greatest(now(), excluded.last_user_at + make_interval(mins => 30 + floor(random() * 31)::integer))
      when not phone_role_push_profiles.enabled and excluded.enabled
        then greatest(now(), coalesce(excluded.last_user_at, now()) + make_interval(mins => 30 + floor(random() * 31)::integer))
      when phone_role_push_profiles.next_due_at is not null then phone_role_push_profiles.next_due_at
      else now() + make_interval(mins => 30 + floor(random() * 31)::integer) end,
    claimed_until=case when not excluded.enabled or (excluded.last_user_at is not null and (phone_role_push_profiles.last_user_at is null or excluded.last_user_at > phone_role_push_profiles.last_user_at)) then null else phone_role_push_profiles.claimed_until end,
    updated_at=now();
  return true;
end;
$$;

revoke all on function public.phone_role_push_upsert_profile(text,text,jsonb) from public;
grant execute on function public.phone_role_push_upsert_profile(text,text,jsonb) to anon, authenticated;
