-- Atomic point reservation and refund for built-in speech recognition.
-- The account row is locked so duplicate requests cannot be charged twice.

create or replace function public.phone_ai_asr_reserve(
  p_user_id text,
  p_points integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.phone_ai_accounts%rowtype;
  v_existing public.phone_ai_ledger%rowtype;
  v_ledger_id uuid;
  v_balance integer;
begin
  if p_points < 1 or p_points > 1000 then
    raise exception 'invalid-asr-point-cost';
  end if;
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 100 then
    raise exception 'invalid-asr-request-id';
  end if;

  select * into v_account
  from public.phone_ai_accounts
  where user_id = p_user_id
  for update;

  if not found then raise exception 'account-not-found'; end if;
  if v_account.disabled then raise exception 'account-disabled'; end if;

  select * into v_existing
  from public.phone_ai_ledger
  where user_id = p_user_id
    and kind = 'charge'
    and feature = 'asr'
    and request_id = p_request_id
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'ledger_id', v_existing.id,
      'status', v_existing.status,
      'points', abs(v_existing.points),
      'balance', v_account.points
    );
  end if;

  if v_account.points < p_points then raise exception 'no-balance'; end if;
  v_balance := v_account.points - p_points;

  update public.phone_ai_accounts
  set points = v_balance
  where user_id = p_user_id;

  insert into public.phone_ai_ledger(
    user_id, kind, feature, points, balance_after, status, request_id, meta
  ) values (
    p_user_id, 'charge', 'asr', -p_points, v_balance, 'pending', p_request_id,
    jsonb_build_object('reserved', true)
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'duplicate', false,
    'ledger_id', v_ledger_id,
    'status', 'pending',
    'points', p_points,
    'balance', v_balance
  );
end;
$$;

create or replace function public.phone_ai_asr_finish(
  p_ledger_id uuid,
  p_user_id text,
  p_meta jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated uuid;
begin
  update public.phone_ai_ledger
  set status = 'done', meta = coalesce(p_meta, '{}'::jsonb)
  where id = p_ledger_id
    and user_id = p_user_id
    and kind = 'charge'
    and feature = 'asr'
    and status = 'pending'
  returning id into v_updated;
  return v_updated is not null;
end;
$$;

create or replace function public.phone_ai_asr_refund(
  p_ledger_id uuid,
  p_user_id text,
  p_reason text default 'asr-failed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.phone_ai_ledger%rowtype;
  v_points integer;
  v_balance integer;
begin
  select * into v_ledger
  from public.phone_ai_ledger
  where id = p_ledger_id
    and user_id = p_user_id
    and kind = 'charge'
    and feature = 'asr'
  for update;

  if not found then raise exception 'asr-ledger-not-found'; end if;

  select points into v_balance
  from public.phone_ai_accounts
  where user_id = p_user_id
  for update;

  if v_ledger.status <> 'pending' then
    return jsonb_build_object(
      'refunded', 0,
      'status', v_ledger.status,
      'balance', v_balance
    );
  end if;

  v_points := abs(v_ledger.points);
  v_balance := v_balance + v_points;

  update public.phone_ai_accounts
  set points = v_balance
  where user_id = p_user_id;

  update public.phone_ai_ledger
  set status = 'failed',
      meta = jsonb_build_object('refunded', true, 'reason', left(coalesce(p_reason, 'asr-failed'), 300))
  where id = p_ledger_id;

  insert into public.phone_ai_ledger(
    user_id, kind, feature, points, balance_after, status, request_id, meta
  ) values (
    p_user_id, 'refund', 'asr', v_points, v_balance, 'done', p_ledger_id::text,
    jsonb_build_object('reason', left(coalesce(p_reason, 'asr-failed'), 300))
  );

  return jsonb_build_object(
    'refunded', v_points,
    'status', 'failed',
    'balance', v_balance
  );
end;
$$;

revoke all on function public.phone_ai_asr_reserve(text, integer, text) from public, anon, authenticated;
revoke all on function public.phone_ai_asr_finish(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.phone_ai_asr_refund(uuid, text, text) from public, anon, authenticated;
grant execute on function public.phone_ai_asr_reserve(text, integer, text) to service_role;
grant execute on function public.phone_ai_asr_finish(uuid, text, jsonb) to service_role;
grant execute on function public.phone_ai_asr_refund(uuid, text, text) to service_role;
