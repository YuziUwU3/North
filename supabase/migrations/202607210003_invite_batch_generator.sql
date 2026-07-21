create or replace function public.generate_invites(
  p_count integer default 100,
  p_note text default null
)
returns table(invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_created integer := 0;
  v_attempts integer := 0;
  v_note text := coalesce(nullif(trim(p_note), ''), '批量生成 ' || to_char(now(), 'YYYY-MM-DD'));
begin
  if p_count < 1 or p_count > 500 then
    raise exception '生成数量必须在 1 到 500 之间';
  end if;

  while v_created < p_count loop
    v_attempts := v_attempts + 1;
    if v_attempts > p_count * 20 then
      raise exception '生成邀请码失败，请重新执行';
    end if;

    v_code := 'YB-' || upper(substring(md5(
      random()::text || clock_timestamp()::text || v_attempts::text
    ) from 1 for 10));

    insert into public.invites(code, active, note)
    values (v_code, true, v_note)
    on conflict (code) do nothing;

    if found then
      v_created := v_created + 1;
      invite_code := v_code;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_invites(integer, text) from public, anon, authenticated;
grant execute on function public.generate_invites(integer, text) to service_role;

comment on function public.generate_invites(integer, text) is
  '后台批量生成一次性邀请码，默认100个，单次最多500个；不对网页匿名用户开放。';
