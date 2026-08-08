create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'ustaz', 'examiner', 'director');
create type public.exam_period_status as enum ('draft', 'registration_open', 'registration_closed', 'assignment_in_progress', 'assignment_confirmed', 'examination_open', 'examination_closed', 'results_under_review', 'results_returned', 'published', 'archived');
create type public.learning_level as enum ('alif', 'quran');
create type public.registration_status as enum ('draft', 'submitted', 'complete', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'ustaz',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exam_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null,
  starts_on date,
  ends_on date,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status public.exam_period_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text unique not null,
  full_name text not null,
  gender text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.student_registrations (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  ustaz_id uuid not null references public.profiles(id) on delete restrict,
  class_group text,
  current_learning_level public.learning_level not null,
  current_learning_place text,
  registration_status public.registration_status not null default 'draft',
  attendance_status text,
  special_condition text,
  registration_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_period_id, student_id)
);

create index student_registrations_ustaz_period_idx on public.student_registrations (ustaz_id, exam_period_id);
create index student_registrations_period_status_idx on public.student_registrations (exam_period_id, registration_status);
create index students_full_name_idx on public.students (full_name);

alter table public.profiles enable row level security;
alter table public.exam_periods enable row level security;
alter table public.students enable row level security;
alter table public.student_registrations enable row level security;

create function public.current_role() returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "profiles are visible to signed in users" on public.profiles for select to authenticated using (true);
create policy "admins manage exam periods" on public.exam_periods for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "users read their permitted students" on public.students for select to authenticated using (
  public.current_role() in ('admin', 'director') or exists (select 1 from public.student_registrations r where r.student_id = students.id and r.ustaz_id = auth.uid())
);
create policy "ustazes create students" on public.students for insert to authenticated with check (public.current_role() in ('admin', 'ustaz'));
create policy "ustazes view own registrations" on public.student_registrations for select to authenticated using (
  public.current_role() in ('admin', 'director') or ustaz_id = auth.uid()
);
create policy "ustazes create own registrations" on public.student_registrations for insert to authenticated with check (
  public.current_role() = 'admin' or (public.current_role() = 'ustaz' and ustaz_id = auth.uid())
);
create policy "ustazes update own open registrations" on public.student_registrations for update to authenticated using (
  public.current_role() = 'admin' or (public.current_role() = 'ustaz' and ustaz_id = auth.uid())
);
