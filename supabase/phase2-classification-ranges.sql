create table if not exists public.exam_assignment_groups (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  group_key text not null,
  group_title text not null,
  group_order integer not null,
  learning_level public.learning_level not null,
  place_start integer not null check (place_start >= 1),
  place_end integer not null check (place_end >= place_start),
  big_ustaz_id uuid references public.profiles(id) on delete restrict,
  examiner_id uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_period_id, group_key, place_start, place_end)
);

create index if not exists exam_assignment_groups_period_idx
  on public.exam_assignment_groups (exam_period_id, group_order);

create index if not exists exam_assignment_groups_big_ustaz_idx
  on public.exam_assignment_groups (big_ustaz_id)
  where big_ustaz_id is not null;

create index if not exists exam_assignment_groups_examiner_idx
  on public.exam_assignment_groups (examiner_id)
  where examiner_id is not null;

create index if not exists exam_assignment_groups_created_by_idx
  on public.exam_assignment_groups (created_by);

alter table public.exam_assignment_groups enable row level security;

drop policy if exists "admins manage assignment groups" on public.exam_assignment_groups;
drop policy if exists "examiners read their assignment groups" on public.exam_assignment_groups;

create policy "admins and examiners read assignment groups"
on public.exam_assignment_groups
for select
to authenticated
using ((select public.current_role()) = 'admin' or examiner_id = (select auth.uid()));

create policy "admins create assignment groups"
on public.exam_assignment_groups
for insert
to authenticated
with check ((select public.current_role()) = 'admin');

create policy "admins update assignment groups"
on public.exam_assignment_groups
for update
to authenticated
using ((select public.current_role()) = 'admin')
with check ((select public.current_role()) = 'admin');

create policy "admins delete assignment groups"
on public.exam_assignment_groups
for delete
to authenticated
using ((select public.current_role()) = 'admin');
