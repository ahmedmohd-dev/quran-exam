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
    if new.result_class = 'second'
      and (new.revision_track is null or new.revision_track not in ('alif', 'quran')) then
      raise exception 'ውጤት ከማስገባትዎ በፊት የሚከለስበትን በቦታ ይምረጡ!';
    end if;
    if new.result_class = 'third'
      and (new.revision_track is null or new.revision_track not in ('alif', 'quran', 'qaida')) then
      raise exception 'ውጤት ከማስገባትዎ በፊት የሚከለስበትን በቦታ ይምረጡ!';
    end if;
    if new.revision_track in ('alif', 'quran') and new.revision_place is null then
      raise exception 'ውጤት ከማስገባትዎ በፊት የሚከለስበትን በቦታ ይምረጡ!';
    end if;
    if new.revision_track = 'alif' and (new.revision_place < 1 or new.revision_place > 27) then
      raise exception 'Alif revision place must be between 1 and 27.';
    end if;
    if new.revision_track = 'quran' and (new.revision_place < 1 or new.revision_place > 114) then
      raise exception 'Qur’an revision place must be between 1 and 114.';
    end if;
  end if;
  return new;
end;
$$;
