-- OpenAI-compatible multi-provider relay: API keys, credits, rate limiting and usage ledger.
-- Run in Supabase SQL Editor before deploying supabase/functions/model-relay.
create extension if not exists pgcrypto;

create table if not exists model_relay_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  label text not null default '',
  credits integer not null default 0 check (credits >= 0),
  enabled boolean not null default true,
  rpm_limit integer not null default 30 check (rpm_limit between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists model_relay_usage (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references model_relay_keys(id) on delete cascade,
  request_id text not null unique,
  feature text not null check (feature in ('chat','vision','image')),
  model text not null,
  points integer not null check (points >= 0),
  balance_after integer not null,
  status text not null default 'pending' check (status in ('pending','done','refunded')),
  http_status integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists model_relay_usage_key_time_idx on model_relay_usage(key_id, created_at desc);

alter table model_relay_keys enable row level security;
alter table model_relay_usage enable row level security;
revoke all on model_relay_keys from anon, authenticated;
revoke all on model_relay_usage from anon, authenticated;

create or replace function model_relay_create_key(p_label text, p_credits integer default 0, p_rpm_limit integer default 30)
returns table(api_key text, key_id uuid, credits integer, rpm_limit integer)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text := 'sk-relay-' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if p_credits < 0 then raise exception 'credits must be non-negative'; end if;
  insert into model_relay_keys(key_hash,label,credits,rpm_limit)
  values (encode(extensions.digest(convert_to(v_key,'utf8'),'sha256'),'hex'),coalesce(p_label,''),p_credits,greatest(1,least(10000,p_rpm_limit)))
  returning id, model_relay_keys.credits, model_relay_keys.rpm_limit into key_id, credits, rpm_limit;
  api_key := v_key;
  return next;
end;
$$;

create or replace function model_relay_grant(p_key_id uuid, p_points integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_points <= 0 then raise exception 'points must be positive'; end if;
  update model_relay_keys set credits=credits+p_points,updated_at=now() where id=p_key_id returning credits into v_balance;
  if v_balance is null then raise exception 'key not found'; end if;
  return v_balance;
end;
$$;

create or replace function model_relay_auth(p_key_hash text)
returns table(key_id uuid, credits integer, rpm_limit integer)
language sql security definer set search_path = public as $$
  select id, model_relay_keys.credits, model_relay_keys.rpm_limit from model_relay_keys where key_hash=p_key_hash and enabled=true limit 1;
$$;

create or replace function model_relay_begin(p_key_hash text,p_feature text,p_cost integer,p_model text,p_request_id text)
returns table(usage_id uuid,balance integer)
language plpgsql security definer set search_path = public as $$
declare v_key model_relay_keys%rowtype;v_usage uuid;v_recent integer;
begin
  select * into v_key from model_relay_keys where key_hash=p_key_hash and enabled=true for update;
  if not found then raise exception 'invalid-api-key'; end if;
  select count(*) into v_recent from model_relay_usage where key_id=v_key.id and created_at>now()-interval '1 minute';
  if v_recent>=v_key.rpm_limit then raise exception 'rate-limit'; end if;
  if v_key.credits<p_cost then raise exception 'insufficient-credits'; end if;
  update model_relay_keys set credits=credits-p_cost,last_used_at=now(),updated_at=now() where id=v_key.id returning credits into balance;
  insert into model_relay_usage(key_id,request_id,feature,model,points,balance_after)
  values(v_key.id,p_request_id,p_feature,p_model,p_cost,balance) returning id into v_usage;
  usage_id:=v_usage;return next;
end;
$$;

create or replace function model_relay_finish(p_usage_id uuid,p_ok boolean,p_http_status integer,p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_usage model_relay_usage%rowtype;
begin
  select * into v_usage from model_relay_usage where id=p_usage_id for update;
  if not found or v_usage.status<>'pending' then return; end if;
  if p_ok then
    update model_relay_usage set status='done',http_status=p_http_status,meta=coalesce(p_meta,'{}'::jsonb),finished_at=now() where id=p_usage_id;
  else
    update model_relay_keys set credits=credits+v_usage.points,updated_at=now() where id=v_usage.key_id;
    update model_relay_usage set status='refunded',http_status=p_http_status,meta=coalesce(p_meta,'{}'::jsonb),finished_at=now() where id=p_usage_id;
  end if;
end;
$$;

revoke all on function model_relay_create_key(text,integer,integer) from public, anon, authenticated;
revoke all on function model_relay_grant(uuid,integer) from public, anon, authenticated;
revoke all on function model_relay_auth(text) from public, anon, authenticated;
revoke all on function model_relay_begin(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function model_relay_finish(uuid,boolean,integer,jsonb) from public, anon, authenticated;
grant execute on function model_relay_auth(text) to service_role;
grant execute on function model_relay_begin(text,text,integer,text,text) to service_role;
grant execute on function model_relay_finish(uuid,boolean,integer,jsonb) to service_role;
