create or replace function public.delete_student_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ustaz_id uuid;
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select role into v_role from public.profiles where id = auth.uid() and active = true;
  select ustaz_id into v_ustaz_id from public.student_registrations where id = p_registration_id;
  if v_ustaz_id is null then raise exception 'Student registration was not found.'; end if;
  if v_role <> 'admin' and (v_role <> 'ustaz' or v_ustaz_id <> auth.uid()) then raise exception 'You cannot delete this student.'; end if;
  delete from public.student_registrations where id = p_registration_id;
end;
$$;

grant execute on function public.delete_student_registration(uuid) to authenticated;
