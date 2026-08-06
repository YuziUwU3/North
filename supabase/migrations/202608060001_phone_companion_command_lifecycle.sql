-- Keep only the newest desired state for each companion target and make stale
-- commands fail closed.  This prevents an iPhone that returns to the foreground
-- from replaying an old lock followed by an old unlock (or the reverse).

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
  v_target text := trim(coalesce(p_target, ''));
  v_action text := lower(trim(coalesce(p_command->>'action', '')));
  v_external_id text := trim(coalesce(p_command->>'externalAppId', ''));
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then
    return null;
  end if;
  if jsonb_typeof(coalesce(p_command, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_command) > 32768 then
    raise exception 'invalid-command';
  end if;

  update public.phone_companion_commands
  set status = 'failed',
      result = jsonb_build_object(
        'code', 'superseded',
        'message', 'superseded by a newer device command'
      ),
      acknowledged_at = now()
  where target = v_target
    and status = 'pending'
    and (
      (
        v_action in ('lock', 'unlock')
        and lower(trim(coalesce(command->>'action', ''))) in ('lock', 'unlock')
        and trim(coalesce(command->>'externalAppId', '')) = v_external_id
      )
      or (
        v_action not in ('lock', 'unlock')
        and lower(trim(coalesce(command->>'action', ''))) = v_action
        and trim(coalesce(command->>'externalAppId', '')) = v_external_id
      )
    );

  insert into public.phone_companion_commands(target, command)
  values (v_target, p_command)
  returning id into v_id;

  delete from public.phone_companion_commands
  where created_at < now() - interval '3 days';

  return v_id;
end;
$$;

create or replace function public.phone_companion_expire_commands(p_target text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  with ranked as (
    select id,
           row_number() over (
             partition by case
               when lower(trim(coalesce(command->>'action', ''))) in ('lock', 'unlock')
                 then 'lock-state:' || trim(coalesce(command->>'externalAppId', ''))
               else lower(trim(coalesce(command->>'action', ''))) || ':' || trim(coalesce(command->>'externalAppId', ''))
             end
             order by created_at desc, id desc
           ) as position
    from public.phone_companion_commands
    where target = trim(coalesce(p_target, ''))
      and status = 'pending'
  )
  update public.phone_companion_commands c
  set status = 'failed',
      result = jsonb_build_object(
        'code', 'superseded',
        'message', 'superseded by a newer device command'
      ),
      acknowledged_at = now()
  from ranked r
  where c.id = r.id
    and r.position > 1;

  update public.phone_companion_commands
  set status = 'failed',
      result = jsonb_build_object(
        'code', 'expired',
        'message', 'device command expired after 15 minutes'
      ),
      acknowledged_at = now()
  where target = trim(coalesce(p_target, ''))
    and status = 'pending'
    and created_at < now() - interval '15 minutes';
end;
$$;

create or replace function public.phone_companion_pull_snapshot(
  p_target text,
  p_owner_secret text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_row public.phone_companion_links%rowtype;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return null;
  end if;

  perform public.phone_companion_expire_commands(p_target);

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

create or replace function public.phone_companion_pull_commands(
  p_target text,
  p_device_secret text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  if not public.phone_companion_device_ok(p_target, p_device_secret) then
    return null;
  end if;

  perform public.phone_companion_expire_commands(p_target);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pending.id,
    'command', pending.command,
    'createdAt', pending.created_at
  ) order by pending.created_at), '[]'::jsonb)
  into v_result
  from (
    select id, command, created_at
    from public.phone_companion_commands
    where target = trim(p_target)
      and status = 'pending'
    order by created_at
    limit 20
  ) pending;

  return v_result;
end;
$$;

revoke all on function public.phone_companion_expire_commands(text) from public;
revoke all on function public.phone_companion_enqueue_command(text, text, jsonb) from public;
revoke all on function public.phone_companion_pull_snapshot(text, text) from public;
revoke all on function public.phone_companion_pull_commands(text, text) from public;

grant execute on function public.phone_companion_enqueue_command(text, text, jsonb) to anon, authenticated;
grant execute on function public.phone_companion_pull_snapshot(text, text) to anon, authenticated;
grant execute on function public.phone_companion_pull_commands(text, text) to anon, authenticated;
