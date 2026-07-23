-- v625 global authorization reset.
-- Preserve licenses and their AI identity bindings, but make every pre-v625
-- authorization, session, recovery key and pending transfer unusable.

with old_licenses as (
  select id from public.phone_licenses where epoch < 4
)
update public.phone_license_sessions
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null
  and license_id in (select id from old_licenses);

with old_licenses as (
  select id from public.phone_licenses where epoch < 4
)
update public.phone_license_bootstraps
set used_at = coalesce(used_at, now())
where used_at is null
  and license_id in (select id from old_licenses);

with old_licenses as (
  select id from public.phone_licenses where epoch < 4
)
update public.phone_license_challenges
set used_at = coalesce(used_at, now())
where used_at is null
  and license_id in (select id from old_licenses);

with old_licenses as (
  select id from public.phone_licenses where epoch < 4
)
update public.phone_license_transfers
set used_at = coalesce(used_at, now())
where used_at is null
  and license_id in (select id from old_licenses);

update public.phone_licenses
set status = 'blocked',
    updated_at = now()
where epoch < 4
  and status <> 'blocked';
