create table if not exists public.exam_period_big_ustazes (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete restrict,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (exam_period_id, ustaz_id)
);

create index if not exists exam_period_big_ustazes_period_idx on public.exam_period_big_ustazes (exam_period_id);
alter table public.exam_period_big_ustazes enable row level security;

drop policy if exists "admins manage big Ustaz groups" on public.exam_period_big_ustazes;
create policy "admins manage big Ustaz groups" on public.exam_period_big_ustazes
for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
