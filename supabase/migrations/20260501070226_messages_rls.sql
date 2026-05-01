-- Enable Row Level Security on messages and conversations.
-- All client (anon) reads/writes are denied — only the service-role
-- key (used in server routes after Pi token verification) can access.

alter table if exists public.messages enable row level security;
alter table if exists public.conversations enable row level security;

drop policy if exists "messages_select_anon" on public.messages;
drop policy if exists "messages_insert_anon" on public.messages;
drop policy if exists "messages_all_anon"    on public.messages;
drop policy if exists "conversations_select_anon" on public.conversations;
drop policy if exists "conversations_all_anon"    on public.conversations;

create policy "messages_no_direct_access"
  on public.messages
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "conversations_no_direct_access"
  on public.conversations
  for all
  to anon, authenticated
  using (false)
  with check (false);
