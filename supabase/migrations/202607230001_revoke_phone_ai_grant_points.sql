-- Manual point grants must never be callable with a public browser key.
revoke all on function public.phone_ai_grant_points(text, integer, text) from public;
revoke all on function public.phone_ai_grant_points(text, integer, text) from anon;
revoke all on function public.phone_ai_grant_points(text, integer, text) from authenticated;
