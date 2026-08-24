-- Read-only access for the general manager (director) dashboard.
drop policy if exists "directors read exam results" on public.exam_results;
create policy "directors read exam results"
on public.exam_results
for select
to authenticated
using (public.current_role() = 'director');

drop policy if exists "directors read supplemental results" on public.exam_supplemental_results;
create policy "directors read supplemental results"
on public.exam_supplemental_results
for select
to authenticated
using (public.current_role() = 'director');

grant select on public.exam_periods, public.exam_results, public.exam_supplemental_results to authenticated;
