-- Keep a privacy-preserving attribution from an invite redemption to its license.
-- The live invite code is never copied into phone_licenses. Admins can still search
-- with the complete original code because both sides use the same SHA-256 fingerprint.

alter table public.phone_licenses
  add column if not exists invite_code_hash text,
  add column if not exists invite_code_hint text;

create index if not exists phone_licenses_invite_code_hash_created_idx
  on public.phone_licenses(invite_code_hash, created_at desc)
  where invite_code_hash is not null;

-- Older one-use redemptions can be linked without guessing: now() is the same
-- transaction timestamp for redeem_invite.used_at and phone_licenses.created_at.
-- Only timestamps that identify exactly one invite and one license are backfilled.
with single_invites as (
  select
    used_at,
    max(code) as code
  from public.invites
  where used_at is not null
    and coalesce(reusable, false) = false
  group by used_at
  having count(*) = 1
),
single_licenses as (
  select
    created_at,
    max(id::text)::uuid as license_id
  from public.phone_licenses
  where invite_code_hash is null
  group by created_at
  having count(*) = 1
),
safe_matches as (
  select
    l.license_id,
    public.normalize_invite_code(i.code) as invite_norm
  from single_licenses l
  join single_invites i on i.used_at = l.created_at
)
update public.phone_licenses target
set
  invite_code_hash = encode(extensions.digest(match.invite_norm, 'sha256'), 'hex'),
  invite_code_hint = case
    when length(match.invite_norm) <= 4 then repeat('*', length(match.invite_norm))
    else left(match.invite_norm, 2)
      || repeat('*', greatest(length(match.invite_norm) - 4, 2))
      || right(match.invite_norm, 2)
  end
from safe_matches match
where target.id = match.license_id
  and target.invite_code_hash is null;

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
  v_invite_norm text := public.normalize_invite_code(p_code);
  v_invite_hint text;
begin
  if coalesce(public.redeem_invite(p_code), false) is not true then
    return;
  end if;

  v_invite_hint := case
    when length(v_invite_norm) <= 4 then repeat('*', length(v_invite_norm))
    else left(v_invite_norm, 2)
      || repeat('*', greatest(length(v_invite_norm) - 4, 2))
      || right(v_invite_norm, 2)
  end;

  insert into public.phone_licenses(
    epoch,
    invite_code_hash,
    invite_code_hint
  )
  values (
    p_epoch,
    encode(extensions.digest(v_invite_norm, 'sha256'), 'hex'),
    v_invite_hint
  )
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

revoke all on function public.redeem_invite_license(text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_invite_license(text, integer, text, text)
  to service_role;

create or replace function public.phone_license_admin_page(
  p_query text default '',
  p_status text default 'all',
  p_offset integer default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_query_raw text := trim(coalesce(p_query, ''));
  v_status text := case
    when lower(coalesce(p_status, '')) in ('active', 'blocked')
      then lower(p_status)
    else 'all'
  end;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 10), 100);
  v_pattern text;
  v_id_pattern text;
  v_invite_hash text;
  v_total bigint := 0;
  v_users jsonb := '[]'::jsonb;
begin
  v_pattern := '%' ||
    replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') ||
    '%';
  v_id_pattern := '%' ||
    replace(replace(replace(replace(v_query, '-', ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') ||
    '%';
  v_invite_hash := case
    when public.normalize_invite_code(v_query_raw) = '' then null
    else encode(
      extensions.digest(public.normalize_invite_code(v_query_raw), 'sha256'),
      'hex'
    )
  end;

  select count(*)
  into v_total
  from public.phone_licenses l
  where (v_status = 'all' or l.status = v_status)
    and (
      v_query = ''
      or lower(coalesce(l.phone_friend_id, '')) like v_pattern escape E'\\'
      or lower(coalesce(l.ai_user_id, '')) like v_pattern escape E'\\'
      or replace(lower(l.id::text), '-', '') like v_id_pattern escape E'\\'
      or l.invite_code_hash = v_invite_hash
    );

  select coalesce(
    jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc, page_row.id desc),
    '[]'::jsonb
  )
  into v_users
  from (
    select
      l.id,
      l.phone_friend_id,
      l.ai_user_id,
      l.invite_code_hint,
      l.status,
      l.epoch,
      l.created_at,
      l.updated_at,
      l.last_seen_at,
      latest_action.action as last_admin_action,
      latest_action.operator_id as last_admin_operator,
      latest_action.created_at as last_admin_action_at
    from public.phone_licenses l
    left join lateral (
      select a.action, a.operator_id, a.created_at
      from public.phone_license_admin_actions a
      where a.license_id = l.id
      order by a.created_at desc
      limit 1
    ) latest_action on true
    where (v_status = 'all' or l.status = v_status)
      and (
        v_query = ''
        or lower(coalesce(l.phone_friend_id, '')) like v_pattern escape E'\\'
        or lower(coalesce(l.ai_user_id, '')) like v_pattern escape E'\\'
        or replace(lower(l.id::text), '-', '') like v_id_pattern escape E'\\'
        or l.invite_code_hash = v_invite_hash
      )
    order by l.created_at desc, l.id desc
    offset v_offset
    limit v_limit
  ) page_row;

  return jsonb_build_object(
    'users', v_users,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit
  );
end
$$;

revoke all on function public.phone_license_admin_page(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.phone_license_admin_page(text, text, integer, integer)
  to service_role;

comment on column public.phone_licenses.invite_code_hash is
  '核销邀请码的 SHA-256 指纹，仅供管理员使用完整邀请码精确查询。';
comment on column public.phone_licenses.invite_code_hint is
  '后台展示用的脱敏邀请码提示，不保存邀请码明文。';
comment on function public.phone_license_admin_page(text, text, integer, integer) is
  '管理员授权列表的服务端搜索和分页，支持小手机 ID、AI 用户 ID、授权编号及完整邀请码。';
