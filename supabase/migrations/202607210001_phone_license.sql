create extension if not exists pgcrypto with schema extensions;

create table if not exists public.phone_licenses (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'blocked')),
  epoch integer not null default 3,
  legacy_device_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.phone_license_bootstraps (
  license_id uuid primary key references public.phone_licenses(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz
);

create table if not exists public.phone_license_passkeys (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.phone_licenses(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists phone_license_passkeys_license_idx
  on public.phone_license_passkeys(license_id);

create table if not exists public.phone_license_challenges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('register', 'authenticate')),
  license_id uuid references public.phone_licenses(id) on delete cascade,
  challenge text not null,
  origin text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

create index if not exists phone_license_challenges_expiry_idx
  on public.phone_license_challenges(expires_at);

create table if not exists public.phone_license_sessions (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.phone_licenses(id) on delete cascade,
  token_hash text not null unique,
  label text not null default '手机浏览器',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists phone_license_sessions_active_idx
  on public.phone_license_sessions(license_id, created_at desc)
  where revoked_at is null;

create table if not exists public.phone_license_transfers (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.phone_licenses(id) on delete cascade,
  code_hash text not null unique,
  created_by_session uuid references public.phone_license_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used_at timestamptz
);

create index if not exists phone_license_transfers_expiry_idx
  on public.phone_license_transfers(expires_at);

alter table public.phone_licenses enable row level security;
alter table public.phone_license_bootstraps enable row level security;
alter table public.phone_license_passkeys enable row level security;
alter table public.phone_license_challenges enable row level security;
alter table public.phone_license_sessions enable row level security;
alter table public.phone_license_transfers enable row level security;

revoke all on public.phone_licenses from public, anon, authenticated;
revoke all on public.phone_license_bootstraps from public, anon, authenticated;
revoke all on public.phone_license_passkeys from public, anon, authenticated;
revoke all on public.phone_license_challenges from public, anon, authenticated;
revoke all on public.phone_license_sessions from public, anon, authenticated;
revoke all on public.phone_license_transfers from public, anon, authenticated;

create or replace function public.redeem_invite_license(
  p_code text,
  p_epoch integer,
  p_label text,
  p_user_agent text
)
returns table(license_id uuid, bootstrap_token text, session_token text, session_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_license_id uuid;
  v_bootstrap_token text;
  v_session_token text;
  v_session_id uuid;
begin
  if coalesce(public.redeem_invite(p_code), false) is not true then
    return;
  end if;

  insert into public.phone_licenses(epoch) values (p_epoch)
  returning id into v_license_id;

  v_bootstrap_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.phone_license_bootstraps(license_id, token_hash)
  values (
    v_license_id,
    encode(extensions.digest(v_bootstrap_token, 'sha256'), 'hex')
  );

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.phone_license_sessions(license_id, token_hash, label, user_agent)
  values (
    v_license_id,
    encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
    left(coalesce(nullif(trim(p_label), ''), '手机浏览器'), 80),
    left(coalesce(p_user_agent, ''), 400)
  )
  returning id into v_session_id;

  return query select v_license_id, v_bootstrap_token, v_session_token, v_session_id;
end;
$$;

revoke all on function public.redeem_invite_license(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.redeem_invite_license(text, integer, text, text) to service_role;
