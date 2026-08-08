alter table public.student_registrations
  add column if not exists registered_age integer check (registered_age between 3 and 30);

create sequence if not exists public.student_number_sequence start with 1;

create or replace function public.register_student(
  p_exam_period_id uuid,
  p_full_name text,
  p_registered_age integer,
  p_current_learning_level public.learning_level,
  p_current_learning_place text default null,
  p_class_group text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_student_number text;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register a student.';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and active = true;
  if v_role not in ('admin', 'ustaz') then
    raise exception 'Your account cannot register students.';
  end if;

  if not exists (
    select 1 from public.exam_periods
    where id = p_exam_period_id and status = 'registration_open'
  ) then
    raise exception 'Student registration is not open for this examination period.';
  end if;

  v_student_number := 'QRE-' || lpad(nextval('public.student_number_sequence')::text, 5, '0');

  insert into public.students (student_number, full_name, created_by)
  values (v_student_number, trim(p_full_name), auth.uid())
  returning id into v_student_id;

  insert into public.student_registrations (
    exam_period_id,
    student_id,
    ustaz_id,
    current_learning_level,
    current_learning_place,
    class_group,
    registered_age,
    registration_status
  )
  values (
    p_exam_period_id,
    v_student_id,
    auth.uid(),
    p_current_learning_level,
    nullif(trim(p_current_learning_place), ''),
    nullif(trim(p_class_group), ''),
    p_registered_age,
    'complete'
  );

  return v_student_id;
end;
$$;

grant execute on function public.register_student(uuid, text, integer, public.learning_level, text, text) to authenticated;
