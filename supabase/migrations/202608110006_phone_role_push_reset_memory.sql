-- A local "wipe all role memory" must also remove the server-side proactive
-- context and every undelivered message that was generated from that context.

create or replace function public.phone_role_push_reset_memory(
  p_target text,
  p_owner_secret text,
  p_role_id text,
  p_reset_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_role_id text := left(trim(coalesce(p_role_id, '')), 120);
  v_reset_at timestamptz := least(
    now(),
    to_timestamp(greatest(0, coalesce(p_reset_ms, 0))::numeric / 1000)
  );
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then
    return false;
  end if;
  if v_role_id = '' then raise exception 'invalid-role-id'; end if;

  update public.phone_role_push_profiles
  set recent_context = '',
      memory_context = '',
      last_user_at = v_reset_at,
      quiet_until_at = null,
      next_due_at = case when enabled
        then v_reset_at + make_interval(mins => 30 + floor(random() * 31)::integer)
        else null end,
      claimed_until = null,
      updated_at = now()
  where target = v_target and role_id = v_role_id;

  delete from public.phone_role_push_outbox
  where target = v_target
    and role_id = v_role_id
    and consumed_at is null;

  return true;
end;
$$;

revoke all on function public.phone_role_push_reset_memory(
  text, text, text, bigint
) from public;
grant execute on function public.phone_role_push_reset_memory(
  text, text, text, bigint
) to anon, authenticated;

notify pgrst, 'reload schema';
