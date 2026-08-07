alter table public.phone_role_push_profiles
  add column if not exists avatar_data text not null default '';

alter table public.phone_role_push_outbox
  add column if not exists avatar_token uuid not null default gen_random_uuid();

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
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then return false; end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;
  if length(v_avatar) > 50000
     or v_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then
    v_avatar := '';
  end if;

  insert into public.phone_role_push_profiles (
    target, role_id, role_name, relation, persona, user_name, avatar_data, enabled, timezone,
    start_hour, end_hour, daily_limit, idle_minutes, next_due_at, updated_at
  ) values (
    v_target,
    v_role_id,
    left(trim(coalesce(p_profile->>'roleName', '角色')), 40),
    left(trim(coalesce(p_profile->>'relation', '')), 80),
    left(trim(coalesce(p_profile->>'persona', '')), 1200),
    left(trim(coalesce(p_profile->>'userName', '你')), 40),
    v_avatar,
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
    avatar_data = excluded.avatar_data,
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

revoke all on function public.phone_role_push_upsert_profile(text, text, jsonb) from public;
grant execute on function public.phone_role_push_upsert_profile(text, text, jsonb) to anon, authenticated;
