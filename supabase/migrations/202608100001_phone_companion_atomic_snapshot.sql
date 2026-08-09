-- Keep device snapshots monotonic and complete successful commands together
-- with the verified post-command control snapshot.

create or replace function public.phone_companion_snapshot_sequence(
  p_snapshot jsonb
)
returns numeric
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_sequence_text text := coalesce(p_snapshot ->> 'snapshotSequence', '');
begin
  if jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_snapshot) > 524288
     or v_sequence_text !~ '^[0-9]{10,16}$' then
    raise exception 'invalid-snapshot';
  end if;
  return v_sequence_text::numeric;
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
  v_sequence_text text := coalesce(p_snapshot ->> 'snapshotSequence', '');
  v_sequence numeric;
begin
  if not public.phone_companion_device_ok(p_target, p_device_secret) then
    return false;
  end if;
  if jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_snapshot) > 524288 then
    raise exception 'invalid-snapshot';
  end if;
  if v_sequence_text ~ '^[0-9]{10,16}$' then
    v_sequence := v_sequence_text::numeric;
  end if;

  update public.phone_companion_links
  set snapshot = p_snapshot,
      last_sync_at = now(),
      updated_at = now()
  where target = trim(p_target)
    and device_secret_hash = public.phone_companion_hash(p_device_secret)
    and (
      (
        v_sequence is not null
        and coalesce(
          case
            when coalesce(snapshot ->> 'snapshotSequence', '') ~ '^[0-9]{10,16}$'
            then (snapshot ->> 'snapshotSequence')::numeric
            else 0
          end,
          0
        ) < v_sequence
      )
      or (
        v_sequence is null
        and coalesce(snapshot ->> 'snapshotSequence', '') !~ '^[0-9]{10,16}$'
      )
    );
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

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
      result = case
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

revoke all on function public.phone_companion_snapshot_sequence(jsonb) from public;
revoke all on function public.phone_companion_push_snapshot(text, text, jsonb) from public;
revoke all on function public.phone_companion_complete_command(text, text, uuid, jsonb, jsonb) from public;

grant execute on function public.phone_companion_push_snapshot(text, text, jsonb) to anon, authenticated;
grant execute on function public.phone_companion_complete_command(text, text, uuid, jsonb, jsonb) to anon, authenticated;
