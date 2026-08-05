-- Companion device command/audit history is retained for three days only.
delete from public.phone_companion_commands
where created_at < now() - interval '3 days';

create or replace function public.phone_companion_enqueue_command(
  p_target text,
  p_owner_secret text,
  p_command jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return null;
  end if;
  if jsonb_typeof(coalesce(p_command, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_command) > 32768 then
    raise exception 'invalid-command';
  end if;

  insert into public.phone_companion_commands(target, command)
  values (trim(p_target), p_command)
  returning id into v_id;

  delete from public.phone_companion_commands
  where created_at < now() - interval '3 days';

  return v_id;
end;
$$;

revoke all on function public.phone_companion_enqueue_command(text, text, jsonb) from public;
grant execute on function public.phone_companion_enqueue_command(text, text, jsonb) to anon, authenticated;
