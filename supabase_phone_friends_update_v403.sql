-- 小手机好友 v403 补丁：
-- 修复图片头像被截断导致好友头像显示为坏图/问号的问题。

create or replace function phone_friend_upsert_profile(
  p_phone_id text,
  p_secret text,
  p_display_name text,
  p_avatar text,
  p_allow_search boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id text := upper(trim(p_phone_id));
  v_hash text := phone_friend_hash(p_secret);
begin
  if v_id !~ '^SP[A-Z0-9]{8}$' then
    raise exception 'invalid-phone-id';
  end if;
  if coalesce(p_secret,'') = '' then
    raise exception 'missing-secret';
  end if;

  insert into phone_friend_profiles(phone_id, secret_hash, display_name, avatar, allow_search, updated_at)
  values (v_id, v_hash, left(coalesce(p_display_name,'小手机用户'),40), left(coalesce(p_avatar,'🙂'),60000), coalesce(p_allow_search,true), now())
  on conflict (phone_id) do update set
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    allow_search = excluded.allow_search,
    updated_at = now()
  where phone_friend_profiles.secret_hash = v_hash;

  if not found and exists(select 1 from phone_friend_profiles where phone_id = v_id and secret_hash <> v_hash) then
    raise exception 'phone-id-already-owned';
  end if;

  return true;
end $$;

grant execute on function phone_friend_upsert_profile(text,text,text,text,boolean) to anon, authenticated;
