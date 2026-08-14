alter table public.exam_results
  add column if not exists hisnul_muslim_mark numeric(5,2) not null default 0,
  add column if not exists homework_mark numeric(5,2) not null default 0;

alter table public.exam_results
  drop constraint if exists exam_results_hisnul_muslim_mark_check;
alter table public.exam_results
  add constraint exam_results_hisnul_muslim_mark_check
  check (hisnul_muslim_mark between 0 and 20);

alter table public.exam_results
  drop constraint if exists exam_results_homework_mark_check;
alter table public.exam_results
  add constraint exam_results_homework_mark_check
  check (homework_mark between 0 and 5);

create table if not exists public.exam_supplemental_results (
  id uuid primary key default gen_random_uuid(),
  examiner_assignment_id uuid not null unique references public.examiner_assignments(id) on delete cascade,
  student_registration_id uuid not null references public.student_registrations(id) on delete cascade,
  examiner_id uuid not null references public.profiles(id) on delete restrict,
  hisnul_muslim_mark numeric(5,2) not null default 0 check (hisnul_muslim_mark between 0 and 20),
  homework_mark numeric(5,2) not null default 0 check (homework_mark between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exam_supplemental_results enable row level security;

drop policy if exists "admins manage supplemental results" on public.exam_supplemental_results;
create policy "admins manage supplemental results"
on public.exam_supplemental_results for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "examiners manage supplemental results" on public.exam_supplemental_results;
create policy "examiners manage supplemental results"
on public.exam_supplemental_results for all to authenticated
using (
  exists (
    select 1 from public.examiner_assignments assignment
    where assignment.id = exam_supplemental_results.examiner_assignment_id
      and assignment.examiner_id = (select auth.uid())
      and assignment.examiner_id = exam_supplemental_results.examiner_id
      and assignment.student_registration_id = exam_supplemental_results.student_registration_id
  )
)
with check (
  exists (
    select 1 from public.examiner_assignments assignment
    where assignment.id = exam_supplemental_results.examiner_assignment_id
      and assignment.examiner_id = (select auth.uid())
      and assignment.examiner_id = exam_supplemental_results.examiner_id
      and assignment.student_registration_id = exam_supplemental_results.student_registration_id
  )
);

grant select, insert, update, delete on public.exam_supplemental_results to authenticated;
