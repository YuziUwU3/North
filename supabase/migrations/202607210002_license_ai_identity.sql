alter table public.phone_licenses
  add column if not exists ai_user_id text,
  add column if not exists ai_client_secret text;
