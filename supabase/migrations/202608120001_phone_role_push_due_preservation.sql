-- Harmless profile refreshes must not keep postponing a push that is already due.
-- Only genuinely newer user activity, re-enabling a profile, or a missing
-- schedule may create a new 30-to-60-minute first-contact delay.

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
  if length(v_avatar) > 50000
     or v_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then
    v_avatar := '';
  end if;
  if coalesce(p_profile->>'lastUserAt', '') ~ '^[0-9]{10,16}$' then
    v_last_activity := least(now(), to_timestamp((p_profile->>'lastUserAt')::numeric / 1000));
  end if;
  if coalesce(p_profile->>'quietUntilAt', '') ~ '^[0-9]{10,16}$' then
    v_quiet_until := to_timestamp((p_profile->>'quietUntilAt')::numeric / 1000);
  end if;

  insert into public.phone_role_push_profiles (
    target, role_id, role_name, relation, persona, user_name, avatar_data,
    recent_context, memory_context, last_user_at,
    enabled, timezone, start_hour, end_hour, daily_limit, idle_minutes,
    message_min, message_max, quiet_until_at, next_due_at, updated_at
  ) values (
    v_target,
    v_role_id,
    left(trim(coalesce(p_profile->>'roleName', 'Role')), 40),
    left(trim(coalesce(p_profile->>'relation', '')), 80),
    left(trim(coalesce(p_profile->>'persona', '')), 1200),
    left(trim(coalesce(p_profile->>'userName', 'User')), 40),
    v_avatar,
    v_recent,
    v_memory,
    v_last_activity,
    v_enabled,
    case when coalesce(p_profile->>'timezone', '') ~ '^[A-Za-z0-9_+/:.-]{1,64}$'
      then p_profile->>'timezone' else 'Asia/Shanghai' end,
    0,
    0,
    greatest(1, least(24, coalesce((p_profile->>'dailyLimit')::integer, 2))),
    v_idle,
    v_min,
    v_max,
    v_quiet_until,
    case when v_enabled then greatest(now(), coalesce(v_last_activity, now()) + make_interval(mins => 30 + floor(random() * 31)::integer)) else null end,
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
    start_hour = 0,
    end_hour = 0,
    daily_limit = excluded.daily_limit,
    idle_minutes = excluded.idle_minutes,
    message_min = excluded.message_min,
    message_max = excluded.message_max,
    quiet_until_at = excluded.quiet_until_at,
    next_due_at = case
      when not excluded.enabled then null
      when excluded.last_user_at is not null
       and (phone_role_push_profiles.last_user_at is null
         or excluded.last_user_at > phone_role_push_profiles.last_user_at)
        then greatest(now(), excluded.last_user_at + make_interval(mins => 30 + floor(random() * 31)::integer))
      when not phone_role_push_profiles.enabled and excluded.enabled
        then greatest(now(), coalesce(excluded.last_user_at, now()) + make_interval(mins => 30 + floor(random() * 31)::integer))
      when phone_role_push_profiles.next_due_at is not null
        then phone_role_push_profiles.next_due_at
      else now() + make_interval(mins => 30 + floor(random() * 31)::integer)
    end,
    claimed_until = case
      when not excluded.enabled then null
      when excluded.last_user_at is not null
       and (phone_role_push_profiles.last_user_at is null
         or excluded.last_user_at > phone_role_push_profiles.last_user_at) then null
      when not phone_role_push_profiles.enabled and excluded.enabled then null
      else phone_role_push_profiles.claimed_until
    end,
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.phone_role_push_upsert_profile(text, text, jsonb) from public;
grant execute on function public.phone_role_push_upsert_profile(text, text, jsonb) to anon, authenticated;
