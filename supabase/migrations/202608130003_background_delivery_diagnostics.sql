-- v908: retain APNs acceptance identifiers separately from user-facing errors.
alter table public.phone_role_push_outbox
  add column if not exists push_diagnostic jsonb not null default '{}'::jsonb;

comment on column public.phone_role_push_outbox.push_diagnostic is
  'APNs acceptance metadata such as apns-id; contains no credentials.';

-- Completing a device command must retain the server-side wake trace that
-- was written before the phone acknowledged the command.
create or replace function public.phone_companion_complete_command(
  p_target text,
  p_device_secret text,
  p_command_id uuid,
  p_snapshot jsonb,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_sequence numeric := public.phone_companion_snapshot_sequence(p_snapshot);
  v_command_id uuid;
  v_count integer := 0;
begin
  if not public.phone_companion_device_ok(v_target, p_device_secret) then
    return false;
  end if;

  select id into v_command_id
  from public.phone_companion_commands
  where id = p_command_id
    and target = v_target
    and status = 'pending'
  for update;
  if v_command_id is null then
    return false;
  end if;

  update public.phone_companion_links
  set snapshot = p_snapshot,
      last_sync_at = now(),
      updated_at = now()
  where target = v_target
    and device_secret_hash = public.phone_companion_hash(p_device_secret)
    and coalesce(
      case
        when coalesce(snapshot ->> 'snapshotSequence', '') ~ '^[0-9]{10,16}$'
        then (snapshot ->> 'snapshotSequence')::numeric
        else 0
      end,
      0
    ) < v_sequence;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'stale-snapshot';
  end if;

  update public.phone_companion_commands
  set status = 'completed',
      result = coalesce(result, '{}'::jsonb) || case
        when jsonb_typeof(coalesce(p_result, '{}'::jsonb)) = 'object'
        then p_result
        else '{}'::jsonb
      end,
      acknowledged_at = now()
  where id = v_command_id
    and target = v_target
    and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'command-completion-race';
  end if;
  return true;
end;
$$;

revoke all on function public.phone_companion_complete_command(text, text, uuid, jsonb, jsonb) from public;
grant execute on function public.phone_companion_complete_command(text, text, uuid, jsonb, jsonb) to anon, authenticated;
