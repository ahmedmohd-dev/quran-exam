create table if not exists public.ustaz_school_students (
  id uuid primary key default gen_random_uuid(),
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  full_name text not null,
  age integer check (age between 3 and 30),
  academic_grade text,
  school_name text,
  school_type text check (school_type in ('public', 'private', 'not_studying')),
  attendance_schedule text check (attendance_schedule in ('morning', 'afternoon', 'full_day')),
  learning_place_type text check (learning_place_type in ('qaida_nuraniya', 'qaida_baghdadiya', 'quran')),
  learning_place_number integer check (learning_place_number between 1 and 114),
  quran_level text check (quran_level in ('beginner', 'intermediate', 'advanced')),
  school_dismissal_time time,
  mederesa_arrival_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ustaz_school_students_ustaz_idx
  on public.ustaz_school_students (ustaz_id);
create unique index if not exists ustaz_school_students_exam_student_idx
  on public.ustaz_school_students (ustaz_id, student_id)
  where student_id is not null;

alter table public.ustaz_school_students enable row level security;

drop policy if exists "ustazes read own school students" on public.ustaz_school_students;
create policy "ustazes read own school students"
  on public.ustaz_school_students for select to authenticated
  using (ustaz_id = auth.uid() or public.current_role() in ('admin', 'director'));

drop policy if exists "ustazes create own school students" on public.ustaz_school_students;
create policy "ustazes create own school students"
  on public.ustaz_school_students for insert to authenticated
  with check (ustaz_id = auth.uid() and public.current_role() = 'ustaz');

drop policy if exists "ustazes update own school students" on public.ustaz_school_students;
create policy "ustazes update own school students"
  on public.ustaz_school_students for update to authenticated
  using (ustaz_id = auth.uid() and public.current_role() = 'ustaz')
  with check (ustaz_id = auth.uid() and public.current_role() = 'ustaz');

drop policy if exists "ustazes delete own school students" on public.ustaz_school_students;
create policy "ustazes delete own school students"
  on public.ustaz_school_students for delete to authenticated
  using (ustaz_id = auth.uid() and public.current_role() = 'ustaz');
