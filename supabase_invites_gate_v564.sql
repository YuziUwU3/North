-- Invite gate repair.
-- Safe rules:
-- 1. Reusable/master codes stay active after redeeming.
-- 2. Ordinary codes are still one-use only.
-- 3. Input is normalized so copied spaces or lowercase letters do not break valid codes.
-- 4. Only the known master-code note is reactivated; old ordinary used codes stay used.

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
    update public.invites
       set used_at = now()
     where code = v_code;
  else
    update public.invites
       set active = false,
           used_at = now()
     where code = v_code;
  end if;

  return true;
end;
$$;

grant execute on function public.normalize_invite_code(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to anon, authenticated;

update public.invites
   set active = true
 where reusable = true
   and active = false
   and coalesce(note, '') like U&'%\4E3B\7801%';
