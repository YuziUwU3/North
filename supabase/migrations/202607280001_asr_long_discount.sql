-- Server-verified long-video ASR discount.
-- Only successfully completed cinema chunks count toward the rebate. Repeated
-- calls are idempotent and only refund the difference after a higher tier is
-- reached.

create or replace function public.phone_ai_asr_long_discount(
  p_user_id text,
  p_job_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.phone_ai_accounts%rowtype;
  v_duration numeric := 0;
  v_charged integer := 0;
  v_already_refunded integer := 0;
  v_rate integer := 0;
  v_target integer := 0;
  v_refund integer := 0;
  v_balance integer := 0;
begin
  if p_job_id is null
     or length(trim(p_job_id)) < 8
     or length(p_job_id) > 100
     or p_job_id !~ '^[A-Za-z0-9_.:-]+$' then
    raise exception 'invalid-asr-job-id';
  end if;

  select * into v_account
  from public.phone_ai_accounts
  where user_id = p_user_id
  for update;

  if not found then raise exception 'account-not-found'; end if;
  if v_account.disabled then raise exception 'account-disabled'; end if;

  select
    coalesce(sum(abs(points)), 0)::integer,
    coalesce(sum((meta->>'duration_seconds')::numeric), 0)
  into v_charged, v_duration
  from public.phone_ai_ledger
  where user_id = p_user_id
    and kind = 'charge'
    and feature = 'asr'
    and status = 'done'
    and meta->>'purpose' = 'cinema_subtitles'
    and meta->>'job_id' = p_job_id;

  if v_duration >= 7200 then v_rate := 10;
  elsif v_duration >= 3600 then v_rate := 8;
  elsif v_duration >= 1800 then v_rate := 5;
  end if;

  v_target := floor(v_charged * v_rate / 100.0)::integer;

  select coalesce(sum(points), 0)::integer
  into v_already_refunded
  from public.phone_ai_ledger
  where user_id = p_user_id
    and kind = 'refund'
    and feature = 'asr_discount'
    and status = 'done'
    and request_id = p_job_id;

  v_refund := greatest(0, v_target - v_already_refunded);
  v_balance := v_account.points;

  if v_refund > 0 then
    v_balance := v_balance + v_refund;
    update public.phone_ai_accounts
    set points = v_balance
    where user_id = p_user_id;

    insert into public.phone_ai_ledger(
      user_id, kind, feature, points, balance_after, status, request_id, meta
    ) values (
      p_user_id, 'refund', 'asr_discount', v_refund, v_balance, 'done', p_job_id,
      jsonb_build_object(
        'note', '长片字幕优惠',
        'job_id', p_job_id,
        'duration_seconds', v_duration,
        'charged_points', v_charged,
        'discount_rate', v_rate,
        'target_refund', v_target
      )
    );
  end if;

  return jsonb_build_object(
    'refunded', v_refund,
    'discount_rate', v_rate,
    'charged_points', v_charged,
    'duration_seconds', v_duration,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.phone_ai_asr_long_discount(text, text) from public, anon, authenticated;
grant execute on function public.phone_ai_asr_long_discount(text, text) to service_role;
