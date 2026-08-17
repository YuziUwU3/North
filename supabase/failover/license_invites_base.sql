-- Minimal invite gate foundation for the isolated license failover project.
-- The rest of the license schema is applied from the existing phone-license
-- migrations so both projects keep the same authorization contract.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invites (
  code text primary key,
  active boolean not null default true,
  reusable boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.invites enable row level security;
revoke all on public.invites from public, anon, authenticated;

create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'))
$$;

create unique index if not exists invites_code_norm_unique
  on public.invites (public.normalize_invite_code(code));

create or replace function public.redeem_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := public.normalize_invite_code(p_code);
  v_code text;
  v_reusable boolean;
begin
  if v_norm = '' then
    return false;
  end if;

  select code, coalesce(reusable, false)
    into v_code, v_reusable
  from public.invites
  where active = true
    and public.normalize_invite_code(code) = v_norm
  for update;

  if not found then
    return false;
  end if;

  if v_reusable then
    update public.invites set used_at = now() where code = v_code;
  else
    update public.invites
      set active = false, used_at = now()
      where code = v_code;
  end if;

  return true;
end;
$$;

revoke all on function public.normalize_invite_code(text)
  from public, anon, authenticated;
revoke all on function public.redeem_invite(text)
  from public, anon, authenticated;
grant execute on function public.normalize_invite_code(text) to service_role;
grant execute on function public.redeem_invite(text) to service_role;

