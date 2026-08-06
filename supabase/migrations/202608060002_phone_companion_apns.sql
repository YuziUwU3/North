alter table public.phone_companion_links
  add column if not exists apns_device_token text,
  add column if not exists apns_environment text,
  add column if not exists apns_updated_at timestamptz;

create or replace function public.phone_companion_register_push_token(
  p_target text,
  p_device_secret text,
  p_device_token text,
  p_environment text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_token text := lower(trim(coalesce(p_device_token, '')));
  v_environment text := lower(trim(coalesce(p_environment, '')));
  v_count integer := 0;
begin
  if not public.phone_companion_device_ok(v_target, p_device_secret) then
    return false;
  end if;
  if v_token !~ '^[0-9a-f]{32,256}$' then
    raise exception 'invalid-apns-device-token';
  end if;
  if v_environment not in ('sandbox', 'production') then
    raise exception 'invalid-apns-environment';
  end if;

  update public.phone_companion_links
  set apns_device_token = v_token,
      apns_environment = v_environment,
      apns_updated_at = now(),
      updated_at = now()
  where target = v_target
    and device_secret_hash = public.phone_companion_hash(p_device_secret);
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.phone_companion_get_push_context(
  p_target text,
  p_owner_secret text,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.phone_companion_links%rowtype;
  v_command public.phone_companion_commands%rowtype;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return null;
  end if;

  select * into v_link
  from public.phone_companion_links
  where target = trim(p_target);

  select * into v_command
  from public.phone_companion_commands
  where id = p_command_id
    and target = v_link.target
    and status = 'pending';

  if v_command.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'deviceToken', v_link.apns_device_token,
    'environment', v_link.apns_environment,
    'commandId', v_command.id,
    'action', lower(trim(coalesce(v_command.command->>'action', 'view'))),
    'externalAppId', trim(coalesce(v_command.command->>'externalAppId', '')),
    'externalAppName', left(trim(coalesce(v_command.command->>'externalAppName', '')), 80),
    'actor', left(trim(coalesce(v_command.command->>'actor', '小手机')), 80)
  );
end;
$$;

revoke all on function public.phone_companion_register_push_token(text, text, text, text) from public;
revoke all on function public.phone_companion_get_push_context(text, text, uuid) from public;

grant execute on function public.phone_companion_register_push_token(text, text, text, text)
  to anon, authenticated;
grant execute on function public.phone_companion_get_push_context(text, text, uuid)
  to service_role;
