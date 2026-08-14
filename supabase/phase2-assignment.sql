create table if not exists public.examiner_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  student_registration_id uuid not null references public.student_registrations(id) on delete cascade,
  examiner_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'submitted', 'returned', 'approved')),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_period_id, student_registration_id)
);

create index if not exists examiner_assignments_examiner_idx
  on public.examiner_assignments (examiner_id, exam_period_id, status);

create index if not exists examiner_assignments_period_idx
  on public.examiner_assignments (exam_period_id, status);

alter table public.examiner_assignments enable row level security;

drop policy if exists "admins manage examiner assignments" on public.examiner_assignments;
create policy "admins manage examiner assignments"
on public.examiner_assignments
for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "examiners read their assignments" on public.examiner_assignments;
create policy "examiners read their assignments"
on public.examiner_assignments
for select
to authenticated
using (examiner_id = auth.uid());

drop policy if exists "examiners update their assignments" on public.examiner_assignments;
create policy "examiners update their assignments"
on public.examiner_assignments
for update
to authenticated
using (examiner_id = auth.uid())
with check (examiner_id = auth.uid());
