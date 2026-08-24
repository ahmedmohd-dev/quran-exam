alter table public.exam_periods
  add column if not exists results_published boolean not null default false;

drop policy if exists "ustazes read submitted results for own students" on public.exam_results;
create policy "ustazes read submitted results for own students"
on public.exam_results
for select
to authenticated
using (
      public.current_role() = 'ustaz'
      and status = 'submitted'
      and examiner_id <> (select auth.uid())
      and exists (
        select 1
        from public.exam_periods period
        where period.id = exam_results.exam_period_id
          and period.results_published = true
      )
      and exists (
    select 1
    from public.student_registrations registration
    where registration.id = exam_results.student_registration_id
      and registration.ustaz_id = (select auth.uid())
  )
);

drop policy if exists "ustazes read supplemental results for own students" on public.exam_supplemental_results;
create policy "ustazes read supplemental results for own students"
on public.exam_supplemental_results
for select
to authenticated
using (
      public.current_role() = 'ustaz'
      and examiner_id <> (select auth.uid())
      and exists (
        select 1
        from public.student_registrations registration
        where registration.id = exam_supplemental_results.student_registration_id
          and registration.ustaz_id = (select auth.uid())
          and exists (
            select 1 from public.exam_periods period
            where period.id = registration.exam_period_id
              and period.results_published = true
          )
      )
);

grant select on public.exam_results to authenticated;
grant select on public.exam_supplemental_results to authenticated;
