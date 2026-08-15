alter table public.exam_results
  add column if not exists revision_track text;

alter table public.exam_results
  drop constraint if exists exam_results_revision_track_check;
alter table public.exam_results
  add constraint exam_results_revision_track_check
  check (revision_track in ('alif', 'quran', 'qaida', 'admin') or revision_track is null);

create or replace function public.validate_exam_revision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  registration_level public.learning_level;
begin
  select current_learning_level into registration_level
  from public.student_registrations
  where id = new.student_registration_id;

  if new.result_class = 'first' then
    new.revision_track := null;
    new.revision_place := null;
  elsif new.result_class = 'fourth' then
    new.revision_track := case when registration_level = 'alif' then 'qaida' else 'admin' end;
    new.revision_place := null;
  elsif new.status = 'submitted' then
    if new.revision_track is null then
      raise exception 'Choose the revision destination before submitting.';
    end if;
    if new.revision_track in ('alif', 'quran') and new.revision_place is null then
      raise exception 'Choose the revision place before submitting.';
    end if;
    if new.revision_track = 'alif' and (new.revision_place < 1 or new.revision_place > 27) then
      raise exception 'Alif revision place must be between 1 and 27.';
    end if;
    if new.revision_track = 'quran' and (new.revision_place < 1 or new.revision_place >= (select current_learning_place::integer from public.student_registrations where id = new.student_registration_id)) then
      raise exception 'Qur’an revision must be below the registered surah.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_exam_revision on public.exam_results;
create trigger validate_exam_revision
before insert or update on public.exam_results
for each row execute function public.validate_exam_revision();

grant select, insert, update on public.exam_results to authenticated;
