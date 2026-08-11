-- Bind the private all-in-one iOS app itself as the companion device.
-- This removes the old requirement to pair a second companion page before
-- APNs proactive-role notifications can be registered.

create or replace function public.claim_private_phone_unified_controller(
  p_target text,
  p_new_owner_secret text,
  p_controller_instance_id text,
  p_device_secret text,
  p_device_id text,
  p_device_name text,
  p_apns_token text,
  p_apns_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_target text := trim(coalesce(p_target, ''));
  v_instance text := trim(coalesce(p_controller_instance_id, ''));
  v_device_id text := trim(coalesce(p_device_id, ''));
  v_token text := lower(trim(coalesce(p_apns_token, '')));
  v_environment text := lower(trim(coalesce(p_apns_environment, 'sandbox')));
  v_backup_target text;
  v_row public.phone_companion_links%rowtype;
begin
  if v_user_id is null then raise exception 'authentication-required'; end if;
  if v_target !~ '^yb_[a-z0-9]{20,96}$' then raise exception 'invalid-target'; end if;
  if length(coalesce(p_new_owner_secret, '')) < 24 then raise exception 'weak-owner-secret'; end if;
  if length(coalesce(p_device_secret, '')) < 24 then raise exception 'weak-device-secret'; end if;
  if length(v_instance) < 16 or length(v_instance) > 160 then raise exception 'invalid-controller-instance'; end if;
  if length(v_device_id) < 8 then raise exception 'invalid-device-id'; end if;
  if v_environment not in ('sandbox', 'production') then raise exception 'invalid-apns-environment'; end if;
  if v_token <> '' and (length(v_token) < 32 or length(v_token) > 256 or v_token !~ '^[0-9a-f]+$') then
    raise exception 'invalid-apns-device-token';
  end if;

  select payload #>> '{settings,cloudId}'
    into v_backup_target
  from public.private_phone_backups
  where user_id = v_user_id;
  if coalesce(trim(v_backup_target), '') <> v_target then
    raise exception 'backup-target-mismatch';
  end if;

  insert into public.phone_companion_links (
    target, owner_secret_hash, device_secret_hash, device_id, device_name,
    paired_at, apns_device_token, apns_environment, apns_updated_at,
    controller_user_id, controller_kind, controller_instance_id,
    controller_claimed_at, updated_at
  ) values (
    v_target, public.phone_companion_hash(p_new_owner_secret),
    public.phone_companion_hash(p_device_secret), left(v_device_id, 160),
    left(coalesce(nullif(trim(p_device_name), ''), 'iPhone'), 80), now(),
    nullif(v_token, ''), v_environment,
    case when v_token = '' then null else now() end,
    v_user_id, 'private-small-phone-unified', v_instance, now(), now()
  )
  on conflict (target) do update set
    owner_secret_hash = excluded.owner_secret_hash,
    device_secret_hash = excluded.device_secret_hash,
    device_id = excluded.device_id,
    device_name = excluded.device_name,
    paired_at = coalesce(phone_companion_links.paired_at, now()),
    apns_device_token = coalesce(excluded.apns_device_token, phone_companion_links.apns_device_token),
    apns_environment = excluded.apns_environment,
    apns_updated_at = case when excluded.apns_device_token is null
      then phone_companion_links.apns_updated_at else now() end,
    controller_user_id = excluded.controller_user_id,
    controller_kind = excluded.controller_kind,
    controller_instance_id = excluded.controller_instance_id,
    controller_claimed_at = now(),
    pair_code_hash = null,
    pair_expires_at = null,
    updated_at = now()
  where phone_companion_links.controller_user_id is null
     or phone_companion_links.controller_user_id = v_user_id
  returning * into v_row;

  if v_row.target is null then raise exception 'target-owned-by-other-account'; end if;
  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'linked', true,
    'target', v_row.target,
    'deviceId', v_row.device_id,
    'deviceName', v_row.device_name,
    'pushRegistered', v_row.apns_device_token is not null,
    'controllerKind', v_row.controller_kind,
    'claimedAt', v_row.controller_claimed_at
  );
end;
$$;

revoke all on function public.claim_private_phone_unified_controller(
  text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.claim_private_phone_unified_controller(
  text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.phone_role_push_status(
  p_target text,
  p_owner_secret text,
  p_role_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.phone_companion_links%rowtype;
  v_profile public.phone_role_push_profiles%rowtype;
  v_outbox public.phone_role_push_outbox%rowtype;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return jsonb_build_object('ok', false, 'reason', 'owner-not-linked');
  end if;
  select * into v_link from public.phone_companion_links
    where target = trim(p_target);
  select * into v_profile from public.phone_role_push_profiles
    where target = trim(p_target) and role_id = left(trim(p_role_id), 120);
  select * into v_outbox from public.phone_role_push_outbox
    where target = trim(p_target) and role_id = left(trim(p_role_id), 120)
    order by created_at desc limit 1;
  return jsonb_build_object(
    'ok', true,
    'linked', v_link.device_secret_hash is not null,
    'pushRegistered', v_link.apns_device_token is not null,
    'pushEnvironment', v_link.apns_environment,
    'profileExists', v_profile.role_id is not null,
    'profileEnabled', coalesce(v_profile.enabled, false),
    'nextDueAt', v_profile.next_due_at,
    'lastSentAt', v_profile.last_sent_at,
    'dailyCount', coalesce(v_profile.daily_count, 0),
    'dailyLimit', coalesce(v_profile.daily_limit, 0),
    'lastPushStatus', v_outbox.push_status,
    'lastPushError', v_outbox.push_error,
    'cronActive', exists(
      select 1 from cron.job
      where jobname = 'phone-role-push-every-minute' and active
    )
  );
end;
$$;

revoke all on function public.phone_role_push_status(text, text, text)
  from public;
grant execute on function public.phone_role_push_status(text, text, text)
  to anon, authenticated;
