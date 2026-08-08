drop policy if exists "users read current exam periods" on public.exam_periods;

create policy "users read current exam periods"
on public.exam_periods
for select
to authenticated
using (true);
