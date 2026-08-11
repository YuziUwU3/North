-- Keep the already-installed v894 client working while the current client uses
-- p_apns_environment. PostgREST resolves RPC calls by JSON parameter names, so
-- a legacy p_apns_env request needs a distinct overload. The optional ninth
-- argument makes its PostgreSQL signature unambiguous without changing the
-- eight fields sent by the client.

create or replace function public.claim_private_phone_unified_controller(
  p_target text,
  p_new_owner_secret text,
  p_controller_instance_id text,
  p_device_secret text,
  p_device_id text,
  p_device_name text,
  p_apns_token text,
  p_apns_env text,
  p_legacy_compat boolean default true
)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions
as $$
  select public.claim_private_phone_unified_controller(
    p_target => p_target,
    p_new_owner_secret => p_new_owner_secret,
    p_controller_instance_id => p_controller_instance_id,
    p_device_secret => p_device_secret,
    p_device_id => p_device_id,
    p_device_name => p_device_name,
    p_apns_token => p_apns_token,
    p_apns_environment => p_apns_env
  );
$$;

revoke all on function public.claim_private_phone_unified_controller(
  text, text, text, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.claim_private_phone_unified_controller(
  text, text, text, text, text, text, text, text, boolean
) to authenticated;

notify pgrst, 'reload schema';
