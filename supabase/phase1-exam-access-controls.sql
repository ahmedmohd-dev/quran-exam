alter table public.exam_periods
  add column if not exists exam_marking_closes_at timestamptz null,
  add column if not exists exam_marking_opens_at timestamptz null,
  add column if not exists exam_marking_override text not null default 'automatic',
  add column if not exists ustaz_access_blocked boolean not null default false;

alter table public.exam_periods
  drop constraint if exists exam_periods_exam_marking_override_check;

alter table public.exam_periods
  add constraint exam_periods_exam_marking_override_check
  check (exam_marking_override in ('automatic', 'force_open', 'force_closed'));

-- The live RLS policies and registration function are applied by the access-controls migration.
