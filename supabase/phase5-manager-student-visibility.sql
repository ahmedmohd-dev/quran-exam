drop policy if exists "users read their permitted students" on public.students;
create policy "users read their permitted students"
  on public.students for select to authenticated
  using (
    public.current_role() in ('admin', 'director')
    or exists (
      select 1 from public.student_registrations registration
      where registration.student_id = students.id
        and registration.ustaz_id = auth.uid()
    )
    or exists (
      select 1
      from public.student_registrations registration
      join public.profiles owner on owner.id = registration.ustaz_id
      where registration.student_id = students.id
        and owner.manager_id = auth.uid()
        and owner.role = 'ustaz'
        and owner.active = true
    )
  );
