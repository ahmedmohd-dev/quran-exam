alter table public.profiles add column if not exists ustaz_code text;

create unique index if not exists profiles_ustaz_code_unique_idx
  on public.profiles (ustaz_code)
  where ustaz_code is not null;

update public.profiles
set ustaz_code = 'UST-' || lpad(numbered.row_number::text, 2, '0')
from (
  select id, row_number() over (order by created_at, id) as row_number
  from public.profiles
  where role = 'ustaz' and ustaz_code is null
) numbered
where public.profiles.id = numbered.id;

create or replace function public.assign_next_ustaz_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if new.role = 'ustaz' and new.ustaz_code is null then
    select coalesce(max(substring(ustaz_code from 5)::integer), 0) + 1
    into next_number
    from public.profiles
    where ustaz_code ~ '^UST-[0-9]+$';
    new.ustaz_code := 'UST-' || lpad(next_number::text, 2, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_next_ustaz_code on public.profiles;
create trigger assign_next_ustaz_code before insert on public.profiles for each row execute function public.assign_next_ustaz_code();

revoke all on function public.assign_next_ustaz_code() from public;
grant execute on function public.assign_next_ustaz_code() to authenticated;
