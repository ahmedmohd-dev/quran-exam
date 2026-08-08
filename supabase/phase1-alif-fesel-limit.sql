create or replace function public.update_student_registration(
  p_registration_id uuid,
  p_full_name text,
  p_registered_age integer,
  p_current_learning_level public.learning_level,
  p_current_learning_place text,
  p_study_years integer,
  p_study_months integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_ustaz_id uuid;
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select role into v_role from public.profiles where id = auth.uid() and active = true;
  select student_id, ustaz_id into v_student_id, v_ustaz_id from public.student_registrations where id = p_registration_id;
  if v_student_id is null then raise exception 'Student registration was not found.'; end if;
  if v_role <> 'admin' and (v_role <> 'ustaz' or v_ustaz_id <> auth.uid()) then raise exception 'You cannot edit this student.'; end if;
  if p_registered_age not between 3 and 30 or p_study_years not between 0 and 30 or p_study_months not between 0 and 11 then raise exception 'Invalid registration values.'; end if;
  if p_current_learning_level = 'quran' and p_current_learning_place !~ '^(?:[1-9]|[1-9][0-9]|10[0-9]|11[0-4])$' then raise exception 'Quran Surah number must be between 1 and 114.'; end if;
  if p_current_learning_level = 'alif' and p_current_learning_place !~ '^(?:[1-9]|1[0-9]|2[0-7])$' then raise exception 'Alif Fesel number must be between 1 and 27.'; end if;
  update public.students set full_name = trim(p_full_name) where id = v_student_id;
  update public.student_registrations set registered_age = p_registered_age, current_learning_level = p_current_learning_level, current_learning_place = p_current_learning_place, study_years = p_study_years, study_months = p_study_months, updated_at = now() where id = p_registration_id;
end;
$$;

grant execute on function public.update_student_registration(uuid, text, integer, public.learning_level, text, integer, integer) to authenticated;
