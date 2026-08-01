-- Make friend-request decisions idempotent and collapse a simultaneous
-- reciprocal request when either side accepts. This prevents stale request
-- cards from looking impossible to approve on slow or multi-device clients.

create or replace function public.phone_friend_respond_request(
  p_to_id text,
  p_secret text,
  p_request_id uuid,
  p_accept boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_to text := upper(trim(p_to_id));
  v_from text;
  v_status text;
begin
  if not phone_friend_check(v_to, p_secret) then raise exception 'bad-secret'; end if;

  select r.from_id, r.status into v_from, v_status
  from phone_friend_requests r
  where r.id = p_request_id and r.to_id = v_to
  for update;

  if v_from is null then return false; end if;

  if v_status <> 'pending' then
    return (p_accept and v_status = 'accepted') or (not p_accept and v_status = 'rejected');
  end if;

  update phone_friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = p_request_id and to_id = v_to;

  if p_accept then
    update phone_friend_requests
    set status = 'accepted', updated_at = now()
    where from_id = v_to and to_id = v_from and status = 'pending';
  end if;

  return true;
end $$;

grant execute on function public.phone_friend_respond_request(text,text,uuid,boolean) to anon, authenticated;
