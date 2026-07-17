-- 小手机 AI 账户充值订单确认
-- 先执行 supabase_ai_schema.sql，再执行本文件。
-- 个人收款码没有支付回调：确认收款后，在 SQL Editor 运行：
-- select phone_ai_confirm_purchase('订单UUID', '支付宝/微信流水号');

create or replace function phone_ai_confirm_purchase(
  p_purchase_id uuid,
  p_payment_ref text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase phone_ai_purchases%rowtype;
  v_balance integer;
begin
  select *
    into v_purchase
    from phone_ai_purchases
   where id = p_purchase_id
   for update;

  if not found then
    raise exception 'purchase not found';
  end if;

  if v_purchase.status = 'paid' then
    select points into v_balance
      from phone_ai_accounts
     where user_id = v_purchase.user_id;
    return coalesce(v_balance, 0);
  end if;

  if v_purchase.status <> 'pending' then
    raise exception 'purchase is not pending';
  end if;

  if v_purchase.points > 0 then
    update phone_ai_accounts
       set points = points + v_purchase.points
     where user_id = v_purchase.user_id
     returning points into v_balance;
  else
    select points
      into v_balance
      from phone_ai_accounts
     where user_id = v_purchase.user_id;
  end if;

  if not found then
    raise exception 'AI account not found';
  end if;

  update phone_ai_purchases
     set status = 'paid',
         paid_at = now(),
         external_order_id = nullif(trim(p_payment_ref), '')
   where id = p_purchase_id;

  insert into phone_ai_ledger(
    user_id,
    kind,
    feature,
    points,
    balance_after,
    request_id,
    meta
  )
  values (
    v_purchase.user_id,
    'purchase',
    case when v_purchase.points > 0 then 'recharge' else 'voice_clone_service' end,
    v_purchase.points,
    v_balance,
    p_purchase_id::text,
    jsonb_build_object(
      'provider', v_purchase.provider,
      'amount_cny', v_purchase.amount_cny,
      'payment_ref', nullif(trim(p_payment_ref), '')
    )
  );

  return v_balance;
end;
$$;

revoke all on function phone_ai_confirm_purchase(uuid, text) from public;
revoke all on function phone_ai_confirm_purchase(uuid, text) from anon;
revoke all on function phone_ai_confirm_purchase(uuid, text) from authenticated;
