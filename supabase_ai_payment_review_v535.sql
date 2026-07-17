-- AI account payment review workflow.
-- Run after supabase_ai_schema.sql and supabase_ai_recharge_v533.sql.

alter table phone_ai_purchases add column if not exists plan_id text;
alter table phone_ai_purchases add column if not exists review_status text not null default 'unsubmitted';
alter table phone_ai_purchases add column if not exists payer_hint text;
alter table phone_ai_purchases add column if not exists claimed_paid_at timestamptz;
alter table phone_ai_purchases add column if not exists proof_path text;
alter table phone_ai_purchases add column if not exists review_submitted_at timestamptz;
alter table phone_ai_purchases add column if not exists reviewed_at timestamptz;
alter table phone_ai_purchases add column if not exists review_note text;

create index if not exists phone_ai_purchases_review_idx
  on phone_ai_purchases(review_status, review_submitted_at desc);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'phone-ai-payment-proofs',
  'phone-ai-payment-proofs',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists phone_ai_admin_push (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table phone_ai_admin_push from public;
revoke all on table phone_ai_admin_push from anon;
revoke all on table phone_ai_admin_push from authenticated;

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

  if v_purchase.review_status <> 'submitted' then
    raise exception 'payment proof is not submitted';
  end if;

  if nullif(trim(p_payment_ref), '') is null then
    raise exception 'payment reference is required';
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
         external_order_id = trim(p_payment_ref),
         review_status = 'approved',
         reviewed_at = now(),
         review_note = 'confirmed by admin'
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
      'payment_ref', trim(p_payment_ref),
      'reviewed_at', now()
    )
  );

  return v_balance;
end;
$$;

revoke all on function phone_ai_confirm_purchase(uuid, text) from public;
revoke all on function phone_ai_confirm_purchase(uuid, text) from anon;
revoke all on function phone_ai_confirm_purchase(uuid, text) from authenticated;
