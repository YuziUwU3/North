-- 小手机久未打开 · 云端计时锁
-- 用途：多个 App 自动化同时触发时，只允许第一轮开始倒计时。
-- 在 Supabase SQL Editor 执行一次即可。

create table if not exists public.phone_idle_locks (
  target text primary key,
  token text not null,
  lock_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.phone_idle_locks enable row level security;

revoke all on table public.phone_idle_locks from anon, authenticated;

create or replace function public.phone_idle_try_lock(
  p_target text,
  p_token text,
  p_ttl_seconds integer default 3900
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 3900), 86400));
  v_until timestamptz := now() + make_interval(secs => v_ttl);
begin
  if nullif(trim(coalesce(p_target, '')), '') is null then
    return 'bad_target';
  end if;

  if nullif(trim(coalesce(p_token, '')), '') is null then
    return 'bad_token';
  end if;

  insert into public.phone_idle_locks(target, token, lock_until, updated_at)
  values (trim(p_target), trim(p_token), v_until, now())
  on conflict (target) do update
    set token = excluded.token,
        lock_until = excluded.lock_until,
        updated_at = now()
    where public.phone_idle_locks.lock_until <= now();

  get diagnostics v_count = row_count;

  if v_count > 0 then
    return 'ok';
  end if;

  return 'locked';
end;
$$;

create or replace function public.phone_idle_release_lock(
  p_target text,
  p_token text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  delete from public.phone_idle_locks
  where target = trim(coalesce(p_target, ''))
    and token = trim(coalesce(p_token, ''));

  get diagnostics v_count = row_count;

  if v_count > 0 then
    return 'released';
  end if;

  return 'skip';
end;
$$;

grant execute on function public.phone_idle_try_lock(text, text, integer) to anon, authenticated;
grant execute on function public.phone_idle_release_lock(text, text) to anon, authenticated;
