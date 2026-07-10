-- 修复小手机好友报错：
-- function digest(text, unknown) does not exist
-- 在 Supabase SQL Editor 执行这一小段即可。

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function phone_friend_hash(p_secret text)
returns text language sql immutable as $$
  select encode(extensions.digest(convert_to(coalesce(p_secret,''), 'UTF8'), 'sha256'), 'hex')
$$;
