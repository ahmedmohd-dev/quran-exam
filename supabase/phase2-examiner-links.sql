create table if not exists public.examiner_ustaz_links (
  id uuid primary key default gen_random_uuid(),
  examiner_id uuid not null unique references public.profiles(id) on delete cascade,
  ustaz_id uuid not null unique references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (examiner_id <> ustaz_id)
);

create index if not exists examiner_ustaz_links_ustaz_idx
  on public.examiner_ustaz_links (ustaz_id);

alter table public.examiner_ustaz_links enable row level security;

drop policy if exists "admins manage examiner links" on public.examiner_ustaz_links;
create policy "admins manage examiner links"
on public.examiner_ustaz_links
for all
to authenticated
using ((select public.current_role()) = 'admin')
with check ((select public.current_role()) = 'admin');

drop policy if exists "examiners read own examiner link" on public.examiner_ustaz_links;
create policy "examiners read own examiner link"
on public.examiner_ustaz_links
for select
to authenticated
using (examiner_id = (select auth.uid()));

grant select, insert, update, delete on public.examiner_ustaz_links to authenticated;

create or replace function public.ensure_valid_examiner_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  student_ustaz_id uuid;
  linked_ustaz_id uuid;
begin
  select ustaz_id into student_ustaz_id
  from public.student_registrations
  where id = new.student_registration_id;

  select ustaz_id into linked_ustaz_id
  from public.examiner_ustaz_links
  where examiner_id = new.examiner_id;

  if student_ustaz_id = linked_ustaz_id then
    raise exception 'An Examiner cannot examine students from their connected Ustaz account.';
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
  linked_ustaz_id uuid;
  assigned_total integer := 0;
  conflict_total integer := 0;
begin
  if (select public.current_role()) <> 'admin' then
    raise exception 'Only the Exam Admin can assign Examiners.';
  end if;

  select * into group_record from public.exam_assignment_groups where id = p_assignment_group_id;
  if not found then raise exception 'The examination range no longer exists.'; end if;

  select ustaz_id into linked_ustaz_id from public.examiner_ustaz_links where examiner_id = p_examiner_id;
  if linked_ustaz_id is null then raise exception 'Connect this Examiner account to its Ustaz account first.'; end if;
  if not exists (select 1 from public.profiles where id = p_examiner_id and role = 'examiner' and active = true) then
    raise exception 'The selected account must be an active Examiner account.';
  end if;

  update public.exam_assignment_groups set examiner_id = p_examiner_id, updated_at = now() where id = p_assignment_group_id;

  select count(*) into conflict_total
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and case when registration.current_learning_place ~ '^[0-9]+$' then registration.current_learning_place::integer end between group_record.place_start and group_record.place_end
    and registration.ustaz_id = linked_ustaz_id
    and not exists (select 1 from public.exam_period_big_ustazes big_ustaz where big_ustaz.exam_period_id = group_record.exam_period_id and big_ustaz.ustaz_id = registration.ustaz_id);

  insert into public.examiner_assignments (exam_period_id, student_registration_id, assignment_group_id, examiner_id, assigned_by)
  select registration.exam_period_id, registration.id, group_record.id, p_examiner_id, (select auth.uid())
  from public.student_registrations registration
  where registration.exam_period_id = group_record.exam_period_id
    and registration.current_learning_level = group_record.learning_level
    and case when registration.current_learning_place ~ '^[0-9]+$' then registration.current_learning_place::integer end between group_record.place_start and group_record.place_end
    and registration.ustaz_id <> linked_ustaz_id
    and not exists (select 1 from public.exam_period_big_ustazes big_ustaz where big_ustaz.exam_period_id = group_record.exam_period_id and big_ustaz.ustaz_id = registration.ustaz_id)
  on conflict (exam_period_id, student_registration_id) do update set assignment_group_id = excluded.assignment_group_id, examiner_id = excluded.examiner_id, assigned_by = excluded.assigned_by, status = 'assigned', assigned_at = now(), updated_at = now();

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
  if (select public.current_role()) <> 'admin' then raise exception 'Only the Exam Admin can assign Examiners.'; end if;
  if not exists (select 1 from public.profiles where id = p_examiner_id and role = 'examiner' and active = true) then raise exception 'The selected account must be an active Examiner account.'; end if;
  if exists (select 1 from public.student_registrations where id = any(p_student_registration_ids) and exam_period_id <> p_exam_period_id) then raise exception 'Every selected student must belong to the current examination session.'; end if;

  insert into public.examiner_assignments (exam_period_id, student_registration_id, examiner_id, assigned_by)
  select p_exam_period_id, registration.id, p_examiner_id, (select auth.uid())
  from public.student_registrations registration
  where registration.id = any(p_student_registration_ids) and registration.exam_period_id = p_exam_period_id
  on conflict (exam_period_id, student_registration_id) do update set assignment_group_id = null, examiner_id = excluded.examiner_id, assigned_by = excluded.assigned_by, status = 'assigned', assigned_at = now(), updated_at = now();

  get diagnostics assigned_total = row_count;
  return assigned_total;
end;
$$;

revoke all on function public.assign_examiner_group(uuid, uuid) from public;
revoke all on function public.assign_examiner_students(uuid, uuid[], uuid) from public;
grant execute on function public.assign_examiner_group(uuid, uuid) to authenticated;
grant execute on function public.assign_examiner_students(uuid, uuid[], uuid) to authenticated;
