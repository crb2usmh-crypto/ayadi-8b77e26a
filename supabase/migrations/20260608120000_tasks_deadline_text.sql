-- Ensure tasks.deadline accepts any free-form string.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'deadline'
      and data_type <> 'text'
  ) then
    alter table public.tasks alter column deadline type text using deadline::text;
  end if;
end $$;
