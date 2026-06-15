-- Fix bids trigger: an older handle_new_bid (or stale trigger) references
-- NEW.pi_uid, which doesn't exist on public.bids. Inserts fail with
-- "record \"new\" has no field \"pi_uid\"". Drop every trigger on bids,
-- recreate the correct function, reattach a single AFTER INSERT trigger.

do $cleanup$
declare
  trg record;
begin
  if to_regclass('public.bids') is not null then
    for trg in
      select tgname
        from pg_trigger
       where tgrelid = 'public.bids'::regclass
         and not tgisinternal
    loop
      execute format('drop trigger if exists %I on public.bids', trg.tgname);
    end loop;
  end if;
end
$cleanup$;

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
    null; -- never block the bid insert on notification failure
  end;
  return new;
end
$fn$;

do $trg$
begin
  if to_regclass('public.bids') is not null then
    create trigger trg_handle_new_bid
      after insert on public.bids
      for each row execute function public.handle_new_bid();
  end if;
end
$trg$;
