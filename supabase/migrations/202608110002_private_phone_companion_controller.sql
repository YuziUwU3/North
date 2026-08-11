-- The private Small Phone app is the only controller allowed to rotate the
-- browser-side companion owner key. The real iPhone keeps its device key, so
-- reclaiming control never unpairs or unlocks the device.

alter table public.phone_companion_links
  add column if not exists controller_user_id uuid references auth.users(id) on delete set null,
  add column if not exists controller_kind text,
  add column if not exists controller_instance_id text,
  add column if not exists controller_claimed_at timestamptz;

create or replace function public.claim_private_phone_companion_controller(
  p_target text,
  p_new_owner_secret text,
  p_controller_instance_id text
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
  v_backup_target text;
  v_row public.phone_companion_links%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication-required';
  end if;
  if v_target !~ '^yb_[a-z0-9]{20,96}$' then
    raise exception 'invalid-target';
  end if;
  if length(coalesce(p_new_owner_secret, '')) < 24 then
    raise exception 'weak-owner-secret';
  end if;
  if length(v_instance) < 16 or length(v_instance) > 160 then
    raise exception 'invalid-controller-instance';
  end if;

  select payload #>> '{settings,cloudId}'
    into v_backup_target
  from public.private_phone_backups
  where user_id = v_user_id;

  if coalesce(trim(v_backup_target), '') <> v_target then
    raise exception 'backup-target-mismatch';
  end if;

  update public.phone_companion_links
  set owner_secret_hash = public.phone_companion_hash(p_new_owner_secret),
      controller_user_id = v_user_id,
      controller_kind = 'private-small-phone',
      controller_instance_id = v_instance,
      controller_claimed_at = now(),
      pair_code_hash = null,
      pair_expires_at = null,
      updated_at = now()
  where target = v_target
    and device_secret_hash is not null
  returning * into v_row;

  if not found then
    raise exception 'linked-device-not-found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'linked', true,
    'target', v_row.target,
    'deviceId', v_row.device_id,
    'deviceName', v_row.device_name,
    'controllerKind', v_row.controller_kind,
    'claimedAt', v_row.controller_claimed_at
  );
end;
$$;

revoke all on function public.claim_private_phone_companion_controller(text, text, text)
  from public, anon;
grant execute on function public.claim_private_phone_companion_controller(text, text, text)
  to authenticated;

