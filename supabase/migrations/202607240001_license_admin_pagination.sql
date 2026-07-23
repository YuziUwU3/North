create index if not exists phone_licenses_status_created_id_idx
  on public.phone_licenses(status, created_at desc, id desc);

create index if not exists phone_licenses_created_id_idx
  on public.phone_licenses(created_at desc, id desc);

alter table public.phone_license_admin_actions
  add column if not exists operator_id text;

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
set search_path = public
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_status text := case
    when lower(coalesce(p_status, '')) in ('active', 'blocked')
      then lower(p_status)
    else 'all'
  end;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 10), 100);
  v_pattern text;
  v_id_pattern text;
  v_total bigint := 0;
  v_users jsonb := '[]'::jsonb;
begin
  v_pattern := '%' ||
    replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') ||
    '%';
  v_id_pattern := '%' ||
    replace(replace(replace(replace(v_query, '-', ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') ||
    '%';

  select count(*)
  into v_total
  from public.phone_licenses l
  where (v_status = 'all' or l.status = v_status)
    and (
      v_query = ''
      or lower(coalesce(l.phone_friend_id, '')) like v_pattern escape E'\\'
      or lower(coalesce(l.ai_user_id, '')) like v_pattern escape E'\\'
      or replace(lower(l.id::text), '-', '') like v_id_pattern escape E'\\'
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

comment on function public.phone_license_admin_page(text, text, integer, integer) is
  '管理员授权列表的服务端搜索和分页；已移出记录仍保留并可查询。';
