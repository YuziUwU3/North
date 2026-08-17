drop function if exists public.phone_idle_try_lock(text, text, integer);
drop function if exists public.phone_idle_release_lock(text, text);
drop table if exists public.phone_idle_locks;
drop table if exists public.phone_external_events;
