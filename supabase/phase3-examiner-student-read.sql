drop policy if exists "examiners view assigned registrations" on public.student_registrations;
create policy "examiners view assigned registrations"
on public.student_registrations
for select
to authenticated
using (
  exists (
    select 1
    from public.examiner_assignments assignment
    where assignment.student_registration_id = student_registrations.id
      and assignment.examiner_id = (select auth.uid())
  )
);

drop policy if exists "examiners view assigned students" on public.students;
create policy "examiners view assigned students"
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.student_registrations registration
    join public.examiner_assignments assignment on assignment.student_registration_id = registration.id
    where registration.student_id = students.id
      and assignment.examiner_id = (select auth.uid())
  )
);

grant select on public.student_registrations to authenticated;
grant select on public.students to authenticated;
