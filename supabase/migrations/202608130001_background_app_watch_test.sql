-- v906: allow a real, immediate app-awareness test without consuming the formal daily quota.

alter table public.phone_role_background_tasks
  drop constraint if exists phone_role_background_tasks_kind_check;
alter table public.phone_role_background_tasks
  add constraint phone_role_background_tasks_kind_check
  check (kind in ('reply_handoff','device_handoff','one_minute_test','app_followup','app_watch_test'));

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
  if v_role = '' or v_kind not in ('reply_handoff','device_handoff','one_minute_test','app_followup','app_watch_test') then
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
  elsif v_kind = 'app_watch_test' then
    update public.phone_role_background_tasks
       set status = 'canceled', completed_at = now()
     where target = v_target and role_id = v_role
       and kind = 'app_watch_test' and status in ('pending','claimed');
  end if;

  insert into public.phone_role_background_tasks(target, role_id, kind, payload, baseline_user_at, due_at)
  values(v_target, v_role, v_kind, coalesce(p_payload, '{}'::jsonb), v_baseline, v_due)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.phone_role_background_enqueue(text,text,text,text,jsonb,bigint,bigint) from public;
grant execute on function public.phone_role_background_enqueue(text,text,text,text,jsonb,bigint,bigint) to anon, authenticated;
