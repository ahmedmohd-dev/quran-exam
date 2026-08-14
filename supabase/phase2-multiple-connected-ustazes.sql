alter table public.examiner_ustaz_links
  drop constraint if exists examiner_ustaz_links_examiner_id_key;

alter table public.examiner_ustaz_links
  add constraint examiner_ustaz_links_examiner_ustaz_unique unique (examiner_id, ustaz_id);

create or replace function public.ensure_valid_examiner_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  student_ustaz_id uuid;
begin
  select ustaz_id into student_ustaz_id
  from public.student_registrations
  where id = new.student_registration_id;

  if exists (
    select 1 from public.examiner_ustaz_links
    where examiner_id = new.examiner_id and ustaz_id = student_ustaz_id
  ) then
    raise exception 'An Examiner cannot examine students from any connected Ustaz account.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.examiner_id and role = 'examiner' and active = true
  ) then
    raise exception 'The selected account must be an active Examiner account.';
  end if;

  return new;
end;
$$;

create or replace function public.assign_examiner_group(
  p_assignment_group_id uuid,
  p_examiner_id uuid
)
returns table (assigned_count integer, conflict_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  group_record public.exam_assignment_groups%rowtype;
  assigned_total integer := 0;
  conflict_total integer := 0;
begin
  if (select public.current_role()) <> 'admin' then
    raise exception 'Only the Exam Admin can assign Examiners.';
  end if;

  select * into group_record from public.exam_assignment_groups where id = p_assignment_group_id;
  if not found then raise exception 'The examination range no longer exists.'; end if;

  if not exists (select 1 from public.examiner_ustaz_links where examiner_id = p_examiner_id) then
    raise exception 'Connect this Examiner account to at least one Ustaz account first.';
  end if;
  if not exists (select 1 from public.profiles where id = p_examiner_id and role = 'examiner' and active = true) then
    raise exception 'The selected account must be an active Examiner account.';
  end if;

  update public.exam_assignment_groups set examiner_id = p_examiner_id, updated_at = now() where id = p_assignment_group_id;

  select count(*) into conflict_total
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and case when registration.current_learning_place ~ '^[0-9]+$' then registration.current_learning_place::integer end between group_record.place_start and group_record.place_end
    and exists (select 1 from public.examiner_ustaz_links link where link.examiner_id = p_examiner_id and link.ustaz_id = registration.ustaz_id)
    and not exists (select 1 from public.exam_period_big_ustazes big_ustaz where big_ustaz.exam_period_id = group_record.exam_period_id and big_ustaz.ustaz_id = registration.ustaz_id);

  insert into public.examiner_assignments (exam_period_id, student_registration_id, assignment_group_id, examiner_id, assigned_by)
  select registration.exam_period_id, registration.id, group_record.id, p_examiner_id, (select auth.uid())
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and case when registration.current_learning_place ~ '^[0-9]+$' then registration.current_learning_place::integer end between group_record.place_start and group_record.place_end
    and not exists (select 1 from public.examiner_ustaz_links link where link.examiner_id = p_examiner_id and link.ustaz_id = registration.ustaz_id)
    and not exists (select 1 from public.exam_period_big_ustazes big_ustaz where big_ustaz.exam_period_id = group_record.exam_period_id and big_ustaz.ustaz_id = registration.ustaz_id)
  on conflict (exam_period_id, student_registration_id) do update set assignment_group_id = excluded.assignment_group_id, examiner_id = excluded.examiner_id, assigned_by = excluded.assigned_by, status = 'assigned', assigned_at = now(), updated_at = now();

  get diagnostics assigned_total = row_count;
  return query select assigned_total, conflict_total;
end;
$$;
