alter table public.profiles
  add column if not exists manager_id uuid references public.profiles(id) on delete set null;

drop policy if exists "users read their permitted students" on public.students;
create policy "users read their permitted students"
  on public.students for select to authenticated
  using (
    public.current_role() in ('admin', 'director')
    or exists (select 1 from public.student_registrations registration where registration.student_id = students.id and registration.ustaz_id = auth.uid())
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

create index if not exists profiles_manager_id_idx on public.profiles (manager_id);

drop policy if exists "ustaz managers view subordinate registrations" on public.student_registrations;
create policy "ustaz managers view subordinate registrations"
  on public.student_registrations for select to authenticated
  using (
    public.current_role() = 'ustaz'
    and exists (
      select 1 from public.profiles subordinate
      where subordinate.id = student_registrations.ustaz_id
        and subordinate.manager_id = auth.uid()
        and subordinate.role = 'ustaz'
        and subordinate.active = true
    )
  );

drop policy if exists "ustazes read submitted results for own students" on public.exam_results;
create policy "ustazes read submitted results for own students"
  on public.exam_results for select to authenticated
  using (
    public.current_role() = 'ustaz'
    and status = 'submitted'
    and examiner_id <> auth.uid()
    and exists (select 1 from public.exam_periods period where period.id = exam_results.exam_period_id and period.results_published = true)
    and exists (
      select 1 from public.student_registrations registration
      left join public.profiles owner on owner.id = registration.ustaz_id
      where registration.id = exam_results.student_registration_id
        and (registration.ustaz_id = auth.uid() or owner.manager_id = auth.uid())
    )
  );

drop policy if exists "ustazes read supplemental results for own students" on public.exam_supplemental_results;
create policy "ustazes read supplemental results for own students"
  on public.exam_supplemental_results for select to authenticated
  using (
    public.current_role() = 'ustaz'
    and examiner_id <> auth.uid()
    and exists (
      select 1 from public.student_registrations registration
      left join public.profiles owner on owner.id = registration.ustaz_id
      join public.exam_periods period on period.id = registration.exam_period_id
      where registration.id = exam_supplemental_results.student_registration_id
        and period.results_published = true
        and (registration.ustaz_id = auth.uid() or owner.manager_id = auth.uid())
    )
  );

create or replace function public.get_own_ustaz_rankings()
returns table (quran_rank integer, hisnul_rank integer, homework_rank integer)
language sql stable security definer set search_path = public
as $$
  with latest_period as (
    select id from public.exam_periods order by created_at desc limit 1
  ), active_ustazes as (
    select id, manager_id from public.profiles where role = 'ustaz' and active = true
  ), owners as (
    select id as owner_id from active_ustazes where manager_id is null
  ), scores as (
    select owner.owner_id,
      avg(result.total_mark)::numeric as quran_average,
      avg(supplemental.hisnul_muslim_mark / 20.0 * 100) filter (where supplemental.hisnul_muslim_mark is not null and ((coalesce(registration.study_years, 0) * 12 + coalesce(registration.study_months, 0)) not in (1, 2)))::numeric as hisnul_average,
      avg(supplemental.homework_mark / 5.0 * 100) filter (where supplemental.homework_mark is not null)::numeric as homework_average
    from owners owner
    join active_ustazes member on member.id = owner.owner_id or member.manager_id = owner.owner_id
    join public.student_registrations registration on registration.ustaz_id = member.id and registration.exam_period_id = (select id from latest_period)
    join public.exam_results result on result.student_registration_id = registration.id and result.status = 'submitted'
    left join public.exam_supplemental_results supplemental on supplemental.examiner_assignment_id = result.examiner_assignment_id
    group by owner.owner_id
  ), ranked as (
    select owner_id,
      rank() over (order by quran_average desc nulls last)::integer as quran_rank,
      case when hisnul_average is null then null else rank() over (order by hisnul_average desc nulls last)::integer end as hisnul_rank,
      case when homework_average is null then null else rank() over (order by homework_average desc nulls last)::integer end as homework_rank
    from scores
  )
  select quran_rank, hisnul_rank, homework_rank from ranked where owner_id = auth.uid();
$$;

grant execute on function public.get_own_ustaz_rankings() to authenticated;
