-- Keep friend search, requests, messages, receipts and group sync responsive
-- when many phones poll at the same time. All indexes are additive and safe to
-- run more than once.

create index if not exists phone_friend_requests_from_status_updated_idx
  on public.phone_friend_requests(from_id, status, updated_at desc);

create index if not exists phone_friend_requests_to_status_updated_idx
  on public.phone_friend_requests(to_id, status, updated_at desc);

create index if not exists phone_friend_messages_from_created_idx
  on public.phone_friend_messages(from_id, created_at desc);

create index if not exists phone_friend_messages_to_created_idx
  on public.phone_friend_messages(to_id, created_at desc);

create index if not exists phone_friend_group_members_phone_group_idx
  on public.phone_friend_group_members(phone_id, group_id);

create index if not exists phone_friend_group_messages_group_created_idx
  on public.phone_friend_group_messages(group_id, created_at desc);

create index if not exists phone_friend_message_receipts_received_idx
  on public.phone_friend_message_receipts(received_at desc, message_id);

create index if not exists phone_friend_group_message_receipts_received_idx
  on public.phone_friend_group_message_receipts(received_at desc, message_id);

create index if not exists phone_friend_message_recalls_recalled_idx
  on public.phone_friend_message_recalls(recalled_at desc, message_id);
