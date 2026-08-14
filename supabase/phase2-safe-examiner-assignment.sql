alter table public.examiner_assignments
  add column if not exists assignment_group_id uuid references public.exam_assignment_groups(id) on delete set null;

create index if not exists examiner_assignments_assignment_group_idx
  on public.examiner_assignments (assignment_group_id)
  where assignment_group_id is not null;

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

  if student_ustaz_id = new.examiner_id then
    raise exception 'An Ustaz cannot examine their own student. Assign this student to another Examiner.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.examiner_id
      and role = 'ustaz'
      and active = true
  ) then
    raise exception 'The selected Examiner must be an active Ustaz.';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_valid_examiner_assignment() from public;

drop trigger if exists validate_examiner_assignment on public.examiner_assignments;
create trigger validate_examiner_assignment
before insert or update of student_registration_id, examiner_id
on public.examiner_assignments
for each row execute function public.ensure_valid_examiner_assignment();

drop policy if exists "admins manage examiner assignments" on public.examiner_assignments;
drop policy if exists "examiners read their assignments" on public.examiner_assignments;
drop policy if exists "examiners update their assignments" on public.examiner_assignments;

create policy "admins and examiners read assignments"
on public.examiner_assignments
for select
to authenticated
using ((select public.current_role()) = 'admin' or examiner_id = (select auth.uid()));

create policy "admins create assignments"
on public.examiner_assignments
for insert
to authenticated
with check ((select public.current_role()) = 'admin');

create policy "admins and examiners update assignments"
on public.examiner_assignments
for update
to authenticated
using ((select public.current_role()) = 'admin' or examiner_id = (select auth.uid()))
with check ((select public.current_role()) = 'admin' or examiner_id = (select auth.uid()));

create policy "admins delete assignments"
on public.examiner_assignments
for delete
to authenticated
using ((select public.current_role()) = 'admin');

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

  select * into group_record
  from public.exam_assignment_groups
  where id = p_assignment_group_id;

  if not found then
    raise exception 'The examination range no longer exists.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_examiner_id and role = 'ustaz' and active = true
  ) then
    raise exception 'The selected Examiner must be an active Ustaz.';
  end if;

  update public.exam_assignment_groups
  set examiner_id = p_examiner_id, updated_at = now()
  where id = p_assignment_group_id;

  select count(*) into conflict_total
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and registration.current_learning_place::integer between group_record.place_start and group_record.place_end
    and registration.ustaz_id = p_examiner_id
    and not exists (
      select 1 from public.exam_period_big_ustazes big_ustaz
      where big_ustaz.exam_period_id = group_record.exam_period_id
        and big_ustaz.ustaz_id = registration.ustaz_id
    );

  insert into public.examiner_assignments (
    exam_period_id,
    student_registration_id,
    assignment_group_id,
    examiner_id,
    assigned_by
  )
  select
    registration.exam_period_id,
    registration.id,
    group_record.id,
    p_examiner_id,
    (select auth.uid())
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and registration.current_learning_place::integer between group_record.place_start and group_record.place_end
    and registration.ustaz_id <> p_examiner_id
    and not exists (
      select 1 from public.exam_period_big_ustazes big_ustaz
      where big_ustaz.exam_period_id = group_record.exam_period_id
        and big_ustaz.ustaz_id = registration.ustaz_id
    )
  on conflict (exam_period_id, student_registration_id)
  do update set
    assignment_group_id = excluded.assignment_group_id,
    examiner_id = excluded.examiner_id,
    assigned_by = excluded.assigned_by,
    status = 'assigned',
    assigned_at = now(),
    updated_at = now();

  get diagnostics assigned_total = row_count;
  return query select assigned_total, conflict_total;
end;
$$;

create or replace function public.assign_examiner_students(
  p_exam_period_id uuid,
  p_student_registration_ids uuid[],
  p_examiner_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  assigned_total integer := 0;
begin
  if (select public.current_role()) <> 'admin' then
    raise exception 'Only the Exam Admin can assign Examiners.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_examiner_id and role = 'ustaz' and active = true
  ) then
    raise exception 'The selected Examiner must be an active Ustaz.';
  end if;

  if exists (
    select 1 from public.student_registrations
    where id = any(p_student_registration_ids)
      and exam_period_id <> p_exam_period_id
  ) then
    raise exception 'Every selected student must belong to the current examination session.';
  end if;

  insert into public.examiner_assignments (
    exam_period_id,
    student_registration_id,
    examiner_id,
    assigned_by
  )
  select
    p_exam_period_id,
    registration.id,
    p_examiner_id,
    (select auth.uid())
  from public.student_registrations registration
  where registration.id = any(p_student_registration_ids)
    and registration.exam_period_id = p_exam_period_id
  on conflict (exam_period_id, student_registration_id)
  do update set
    assignment_group_id = null,
    examiner_id = excluded.examiner_id,
    assigned_by = excluded.assigned_by,
    status = 'assigned',
    assigned_at = now(),
    updated_at = now();

  get diagnostics assigned_total = row_count;
  return assigned_total;
end;
$$;

revoke all on function public.assign_examiner_group(uuid, uuid) from public;
revoke all on function public.assign_examiner_students(uuid, uuid[], uuid) from public;
grant execute on function public.assign_examiner_group(uuid, uuid) to authenticated;
grant execute on function public.assign_examiner_students(uuid, uuid[], uuid) to authenticated;

grant select, insert, update, delete on public.exam_assignment_groups to authenticated;
grant select, insert, update, delete on public.examiner_assignments to authenticated;
