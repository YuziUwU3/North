create table if not exists public.phone_external_events (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists phone_external_events_target_time_idx
  on public.phone_external_events (target, created_at desc);

alter table public.phone_external_events enable row level security;

drop policy if exists "phone_external_events_insert" on public.phone_external_events;
create policy "phone_external_events_insert"
  on public.phone_external_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "phone_external_events_select" on public.phone_external_events;
create policy "phone_external_events_select"
  on public.phone_external_events
  for select
  to anon, authenticated
  using (true);
