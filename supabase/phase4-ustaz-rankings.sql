create or replace function public.get_own_ustaz_rankings()
returns table (quran_rank integer, hisnul_rank integer, homework_rank integer)
language sql
stable
security definer
set search_path = public
as $$
  with latest_period as (
    select id from public.exam_periods order by created_at desc limit 1
  ), scores as (
    select registration.ustaz_id,
      avg(result.total_mark)::numeric as quran_average,
      avg(supplemental.hisnul_muslim_mark / 20.0 * 100) filter (where supplemental.hisnul_muslim_mark is not null)::numeric as hisnul_average,
      avg(supplemental.homework_mark / 5.0 * 100) filter (where supplemental.homework_mark is not null)::numeric as homework_average
    from public.student_registrations registration
    join public.exam_results result on result.student_registration_id = registration.id and result.status = 'submitted'
    left join public.exam_supplemental_results supplemental on supplemental.examiner_assignment_id = result.examiner_assignment_id
    where registration.exam_period_id = (select id from latest_period)
    group by registration.ustaz_id
  ), ranked as (
    select ustaz_id,
      rank() over (order by quran_average desc nulls last)::integer as quran_rank,
      case when hisnul_average is null then null else rank() over (order by hisnul_average desc nulls last)::integer end as hisnul_rank,
      case when homework_average is null then null else rank() over (order by homework_average desc nulls last)::integer end as homework_rank
    from scores
  )
  select quran_rank, hisnul_rank, homework_rank from ranked where ustaz_id = auth.uid();
$$;

grant execute on function public.get_own_ustaz_rankings() to authenticated;
