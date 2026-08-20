-- A notification can be accepted by APNs before the resumed web view has durably
-- stored the matching chat bubble. Re-expose recently consumed real outbox rows;
-- the client receipt ledger deduplicates them after durable local persistence.
create or replace function public.phone_role_push_pull(
  p_target text,
  p_owner_secret text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'roleId', x.role_id, 'roleName', x.role_name,
      'body', x.body, 'triggerKind', x.trigger_kind,
      'pushStatus', x.push_status, 'createdAt', x.created_at,
      'consumedAt', x.consumed_at
    ) order by (x.consumed_at is not null), x.created_at)
    from (
      select * from public.phone_role_push_outbox
      where target = trim(p_target)
        and (
          consumed_at is null
          or (push_status = 'sent' and consumed_at >= now() - interval '24 hours')
        )
      order by (consumed_at is not null), created_at asc
      limit greatest(1, least(50, coalesce(p_limit, 20)))
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.phone_role_push_pull(text, text, integer) from public;
grant execute on function public.phone_role_push_pull(text, text, integer) to anon, authenticated;
