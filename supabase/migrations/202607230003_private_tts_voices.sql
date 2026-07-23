-- Customer-exclusive cloned voices.
-- Voice IDs remain server-managed and are never exposed through public tables.

create table if not exists public.phone_ai_private_voices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.phone_ai_accounts(user_id) on delete cascade,
  purchase_id uuid unique references public.phone_ai_purchases(id) on delete set null,
  voice_id text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phone_ai_private_voices_user_idx
  on public.phone_ai_private_voices(user_id, status, created_at desc);

alter table public.phone_ai_private_voices enable row level security;

revoke all on table public.phone_ai_private_voices from public;
revoke all on table public.phone_ai_private_voices from anon;
revoke all on table public.phone_ai_private_voices from authenticated;
