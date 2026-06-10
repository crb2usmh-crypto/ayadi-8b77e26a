-- Ayadi connection hardening: GRANTs, RLS, triggers, indexes.
-- Idempotent — safe to re-run. Architecture: all writes go through
-- TanStack server routes using service_role (after Pi token verify).
-- Anon/authenticated get SELECT only on profiles and tasks.

do $mig$
declare
  t text;
  public_read text[] := array['profiles','tasks'];
  service_only text[] := array[
    'bids','messages','conversations','notifications',
    'reviews','ayadi_balances','ayadi_claims'
  ];
begin
  foreach t in array (public_read || service_only) loop
    if to_regclass('public.' || t) is not null then
      execute format('grant all on public.%I to service_role', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;

  foreach t in array public_read loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on public.%I to anon', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
  end loop;

  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles_public_select" on public.profiles';
    execute 'drop policy if exists "profiles_no_direct_write" on public.profiles';
    execute 'create policy "profiles_public_select" on public.profiles for select to anon, authenticated using (true)';
    execute 'create policy "profiles_no_direct_write" on public.profiles for all to anon, authenticated using (false) with check (false)';
  end if;

  if to_regclass('public.tasks') is not null then
    execute 'drop policy if exists "tasks_public_select" on public.tasks';
    execute 'drop policy if exists "tasks_no_direct_write" on public.tasks';
    execute 'create policy "tasks_public_select" on public.tasks for select to anon, authenticated using (true)';
    execute 'create policy "tasks_no_direct_write" on public.tasks for all to anon, authenticated using (false) with check (false)';
  end if;

  foreach t in array service_only loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "%s_no_direct_access" on public.%I', t, t);
      execute format('create policy "%s_no_direct_access" on public.%I for all to anon, authenticated using (false) with check (false)', t, t);
    end if;
  end loop;
end
$mig$;

-- ---------- Triggers ------------------------------------------------

create or replace function public.handle_new_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_uid text;
  task_title text;
begin
  begin
    select owner_pi_uid, title into owner_uid, task_title
      from public.tasks where id = new.task_id;
    if owner_uid is not null and owner_uid <> new.bidder_pi_uid then
      insert into public.notifications
        (recipient_pi_uid, type, title, title_en, body, body_en)
      values
        (owner_uid, 'offer',
         'عرض جديد على مهمتك', 'New offer on your task',
         coalesce(task_title, '') || ' — ' || new.amount::text || ' Pi',
         coalesce(task_title, '') || ' — ' || new.amount::text || ' Pi');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$fn$;

create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_uid text;
  bidder_uid text;
  recipient text;
begin
  begin
    select owner_pi_uid, bidder_pi_uid into owner_uid, bidder_uid
      from public.conversations where id = new.conversation_id;
    recipient := case
      when new.sender_pi_uid = owner_uid then bidder_uid
      else owner_uid
    end;
    if recipient is not null and recipient <> new.sender_pi_uid then
      insert into public.notifications
        (recipient_pi_uid, type, title, title_en, body, body_en)
      values
        (recipient, 'message',
         'رسالة جديدة', 'New message',
         left(new.body, 200), left(new.body, 200));
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$fn$;

do $trg$
begin
  if to_regclass('public.bids') is not null then
    drop trigger if exists trg_handle_new_bid on public.bids;
    create trigger trg_handle_new_bid
      after insert on public.bids
      for each row execute function public.handle_new_bid();
  end if;

  if to_regclass('public.messages') is not null then
    drop trigger if exists trg_handle_new_message on public.messages;
    create trigger trg_handle_new_message
      after insert on public.messages
      for each row execute function public.handle_new_message();
  end if;
end
$trg$;

-- ---------- Indexes -------------------------------------------------

do $idx$
declare
  specs text[][] := array[
    ['profiles','pi_uid','idx_profiles_pi_uid'],
    ['tasks','owner_pi_uid','idx_tasks_owner_pi_uid'],
    ['tasks','status','idx_tasks_status'],
    ['tasks','created_at','idx_tasks_created_at'],
    ['tasks','category','idx_tasks_category'],
    ['tasks','assignee_pi_uid','idx_tasks_assignee_pi_uid'],
    ['bids','task_id','idx_bids_task_id'],
    ['bids','bidder_pi_uid','idx_bids_bidder_pi_uid'],
    ['bids','status','idx_bids_status'],
    ['messages','conversation_id','idx_messages_conversation_id'],
    ['messages','created_at','idx_messages_created_at'],
    ['conversations','task_id','idx_conversations_task_id'],
    ['conversations','owner_pi_uid','idx_conversations_owner_pi_uid'],
    ['conversations','bidder_pi_uid','idx_conversations_bidder_pi_uid'],
    ['notifications','recipient_pi_uid','idx_notifications_recipient'],
    ['notifications','created_at','idx_notifications_created_at'],
    ['reviews','task_id','idx_reviews_task_id'],
    ['reviews','reviewee_pi_uid','idx_reviews_reviewee_pi_uid'],
    ['ayadi_balances','pi_uid','idx_ayadi_balances_pi_uid'],
    ['ayadi_claims','pi_uid','idx_ayadi_claims_pi_uid'],
    ['ayadi_claims','created_at','idx_ayadi_claims_created_at']
  ];
  i int;
begin
  for i in 1 .. array_length(specs, 1) loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = specs[i][1]
        and column_name = specs[i][2]
    ) then
      execute format(
        'create index if not exists %I on public.%I (%I)',
        specs[i][3], specs[i][1], specs[i][2]
      );
    end if;
  end loop;
end
$idx$;
