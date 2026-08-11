create table if not exists public.private_phone_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  source_build text not null default '',
  checksum text not null default '',
  byte_count bigint not null default 0 check (byte_count >= 0),
  payload jsonb not null
);

alter table public.private_phone_backups enable row level security;

revoke all on public.private_phone_backups from public, anon;
grant select, insert, update on public.private_phone_backups to authenticated;

drop policy if exists "private phone owner select" on public.private_phone_backups;
create policy "private phone owner select"
  on public.private_phone_backups
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "private phone owner insert" on public.private_phone_backups;
create policy "private phone owner insert"
  on public.private_phone_backups
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "private phone owner update" on public.private_phone_backups;
create policy "private phone owner update"
  on public.private_phone_backups
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_private_phone_backup(
  p_payload jsonb,
  p_captured_at timestamptz,
  p_source_build text,
  p_checksum text,
  p_byte_count bigint
)
returns table(saved boolean, revision bigint, captured_at timestamptz, uploaded_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.private_phone_backups%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid backup payload' using errcode = '22023';
  end if;

  insert into public.private_phone_backups (
    user_id, revision, captured_at, uploaded_at, source_build,
    checksum, byte_count, payload
  ) values (
    v_user_id, 1, p_captured_at, now(), left(coalesce(p_source_build, ''), 80),
    left(coalesce(p_checksum, ''), 128), greatest(coalesce(p_byte_count, 0), 0), p_payload
  )
  on conflict (user_id) do update
    set revision = private_phone_backups.revision + 1,
        captured_at = excluded.captured_at,
        uploaded_at = now(),
        source_build = excluded.source_build,
        checksum = excluded.checksum,
        byte_count = excluded.byte_count,
        payload = excluded.payload
    where private_phone_backups.captured_at <= excluded.captured_at
  returning private_phone_backups.* into v_row;

  if found then
    return query select true, v_row.revision, v_row.captured_at, v_row.uploaded_at;
  end if;

  select * into v_row
  from public.private_phone_backups
  where user_id = v_user_id;
  return query select false, v_row.revision, v_row.captured_at, v_row.uploaded_at;
end;
$$;

revoke all on function public.save_private_phone_backup(jsonb, timestamptz, text, text, bigint)
  from public, anon;
grant execute on function public.save_private_phone_backup(jsonb, timestamptz, text, text, bigint)
  to authenticated;
