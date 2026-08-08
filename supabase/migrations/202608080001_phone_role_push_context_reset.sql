alter table public.phone_role_push_profiles
  add column if not exists recent_context text not null default '',
  add column if not exists memory_context text not null default '',
  add column if not exists last_user_at timestamptz;

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
  v_avatar text := trim(coalesce(p_profile->>'avatarData', ''));
  v_recent text := left(trim(coalesce(p_profile->>'recentContext', '')), 8000);
  v_memory text := left(trim(coalesce(p_profile->>'memoryContext', '')), 16000);
  v_last_user timestamptz;
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return false; end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;
  if length(v_avatar) > 50000
     or v_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then
    v_avatar := '';
  end if;
  if coalesce(p_profile->>'lastUserAt', '') ~ '^[0-9]{10,16}$' then
    v_last_user := least(now(), to_timestamp((p_profile->>'lastUserAt')::numeric / 1000));
  end if;

  insert into public.phone_role_push_profiles (
    target, role_id, role_name, relation, persona, user_name, avatar_data,
    recent_context, memory_context, last_user_at,
    enabled, timezone, start_hour, end_hour, daily_limit, idle_minutes, next_due_at, updated_at
  ) values (
    v_target,
    v_role_id,
    left(trim(coalesce(p_profile->>'roleName', '角色')), 40),
    left(trim(coalesce(p_profile->>'relation', '')), 80),
    left(trim(coalesce(p_profile->>'persona', '')), 1200),
    left(trim(coalesce(p_profile->>'userName', '你')), 40),
    v_avatar,
    v_recent,
    v_memory,
    v_last_user,
    v_enabled,
    case when coalesce(p_profile->>'timezone', '') ~ '^[A-Za-z0-9_+/:.-]{1,64}$'
      then p_profile->>'timezone' else 'Asia/Shanghai' end,
    greatest(0, least(23, coalesce((p_profile->>'startHour')::integer, 9))),
    greatest(0, least(23, coalesce((p_profile->>'endHour')::integer, 23))),
    greatest(1, least(24, coalesce((p_profile->>'dailyLimit')::integer, 2))),
    v_idle,
    case when v_enabled then greatest(now(), coalesce(v_last_user, now()) + make_interval(mins => v_idle)) else null end,
    now()
  )
  on conflict (target, role_id) do update set
    role_name = excluded.role_name,
    relation = excluded.relation,
    persona = excluded.persona,
    user_name = excluded.user_name,
    avatar_data = excluded.avatar_data,
    recent_context = case
      when excluded.last_user_at is null or phone_role_push_profiles.last_user_at is null
        or excluded.last_user_at >= phone_role_push_profiles.last_user_at then excluded.recent_context
      else phone_role_push_profiles.recent_context end,
    memory_context = case
      when excluded.last_user_at is null or phone_role_push_profiles.last_user_at is null
        or excluded.last_user_at >= phone_role_push_profiles.last_user_at then excluded.memory_context
      else phone_role_push_profiles.memory_context end,
    last_user_at = greatest(phone_role_push_profiles.last_user_at, excluded.last_user_at),
    enabled = excluded.enabled,
    timezone = excluded.timezone,
    start_hour = excluded.start_hour,
    end_hour = excluded.end_hour,
    daily_limit = excluded.daily_limit,
    idle_minutes = excluded.idle_minutes,
    next_due_at = case
      when not excluded.enabled then null
      when excluded.last_user_at is not null
       and (phone_role_push_profiles.last_user_at is null or excluded.last_user_at > phone_role_push_profiles.last_user_at)
        then greatest(now(), excluded.last_user_at + make_interval(mins => excluded.idle_minutes))
      when phone_role_push_profiles.enabled and phone_role_push_profiles.next_due_at > now()
        then phone_role_push_profiles.next_due_at
      else now() + make_interval(mins => excluded.idle_minutes)
    end,
    claimed_until = null,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.phone_role_push_touch_activity(
  p_target text,
  p_owner_secret text,
  p_role_id text,
  p_recent_context text,
  p_memory_context text,
  p_activity_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_role_id text := left(trim(coalesce(p_role_id, '')), 120);
  v_activity timestamptz := least(now(), to_timestamp(greatest(0, coalesce(p_activity_ms, 0))::numeric / 1000));
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return false; end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;

  update public.phone_role_push_profiles
  set recent_context = left(trim(coalesce(p_recent_context, '')), 8000),
      memory_context = left(trim(coalesce(p_memory_context, '')), 16000),
      last_user_at = v_activity,
      next_due_at = case when enabled then v_activity + make_interval(mins => idle_minutes) else null end,
      claimed_until = null,
      updated_at = now()
  where target = v_target
    and role_id = v_role_id
    and (last_user_at is null or v_activity >= last_user_at);
  return found;
end;
$$;

revoke all on function public.phone_role_push_upsert_profile(text, text, jsonb) from public;
grant execute on function public.phone_role_push_upsert_profile(text, text, jsonb) to anon, authenticated;
revoke all on function public.phone_role_push_touch_activity(text, text, text, text, text, bigint) from public;
grant execute on function public.phone_role_push_touch_activity(text, text, text, text, text, bigint) to anon, authenticated;
