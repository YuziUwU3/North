create table if not exists public.phone_license_incident_recovery (
  id boolean primary key default true check (id),
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  operator_id text not null
);

alter table public.phone_license_incident_recovery enable row level security;
revoke all on public.phone_license_incident_recovery from public, anon, authenticated;

create or replace function public.phone_license_restore_all_safe(
  p_epoch integer,
  p_operator_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored bigint := 0;
  v_total bigint := 0;
  v_expires_at timestamptz := now() + interval '24 hours';
begin
  if coalesce(p_epoch, 0) < 1 then
    raise exception 'invalid-license-epoch';
  end if;

  select count(*) into v_total from public.phone_licenses;

  with restored as (
    update public.phone_licenses l
    set status = 'active',
        epoch = p_epoch,
        updated_at = now()
    where l.status <> 'active' or l.epoch <> p_epoch
    returning l.id
  )
  select count(*) into v_restored from restored;

  insert into public.phone_license_incident_recovery(id, opened_at, expires_at, operator_id)
  values (true, now(), v_expires_at, left(coalesce(nullif(trim(p_operator_id), ''), 'owner'), 80))
  on conflict (id) do update
  set opened_at = excluded.opened_at,
      expires_at = excluded.expires_at,
      operator_id = excluded.operator_id;

  return jsonb_build_object(
    'restored', v_restored,
    'total', v_total,
    'expires_at', v_expires_at
  );
end
$$;

revoke all on function public.phone_license_restore_all_safe(integer, text)
  from public, anon, authenticated;
grant execute on function public.phone_license_restore_all_safe(integer, text)
  to service_role;

comment on function public.phone_license_restore_all_safe(integer, text) is
  '恢复全部授权（包括已移出记录），并开放24小时本机身份自助恢复。';
