-- 小手机内置 AI · Supabase 数据库基础
-- 先在 Supabase SQL Editor 里执行本文件，再部署 supabase/functions/phone-ai。
-- 第一版默认不自动赠送免费点，避免测试阶段被反复注册白嫖。

create table if not exists phone_ai_accounts (
  user_id text primary key,
  client_secret text,
  points integer not null default 0 check (points >= 0),
  free_granted boolean not null default false,
  disabled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table phone_ai_accounts add column if not exists client_secret text;

create table if not exists phone_ai_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references phone_ai_accounts(user_id) on delete cascade,
  kind text not null check (kind in ('grant','charge','refund','purchase')),
  feature text not null,
  points integer not null,
  balance_after integer,
  status text not null default 'done',
  request_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists phone_ai_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references phone_ai_accounts(user_id) on delete cascade,
  provider text not null default 'manual',
  amount_cny numeric(10,2) not null,
  points integer not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  external_order_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists phone_ai_ledger_user_time_idx on phone_ai_ledger(user_id, created_at desc);
create index if not exists phone_ai_purchases_user_time_idx on phone_ai_purchases(user_id, created_at desc);

create or replace function phone_ai_touch_account()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists phone_ai_accounts_touch on phone_ai_accounts;
create trigger phone_ai_accounts_touch
before update on phone_ai_accounts
for each row execute function phone_ai_touch_account();

-- 后台手动加点：测试阶段你可以在 SQL Editor 里执行：
-- select phone_ai_grant_points('用户ID', 1000, '测试加点');
create or replace function phone_ai_grant_points(p_user_id text, p_points integer, p_note text default 'manual grant')
returns integer language plpgsql security definer as $$
declare
  v_balance integer;
begin
  if p_points <= 0 then
    raise exception 'points must be positive';
  end if;

  insert into phone_ai_accounts(user_id, points)
  values (p_user_id, p_points)
  on conflict (user_id) do update set points = phone_ai_accounts.points + excluded.points
  returning points into v_balance;

  insert into phone_ai_ledger(user_id, kind, feature, points, balance_after, meta)
  values (p_user_id, 'grant', 'manual', p_points, v_balance, jsonb_build_object('note', p_note));

  return v_balance;
end;
$$;

-- 个人收款码阶段的订单确认函数见 supabase_ai_recharge_v533.sql。
