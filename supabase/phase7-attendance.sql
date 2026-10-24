create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  note text,
  marked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create index if not exists attendance_records_ustaz_date_idx
  on public.attendance_records (ustaz_id, attendance_date);
create index if not exists attendance_records_student_date_idx
  on public.attendance_records (student_id, attendance_date);

alter table public.attendance_records enable row level security;

drop policy if exists "attendance visible to permitted users" on public.attendance_records;
create policy "attendance visible to permitted users"
  on public.attendance_records for select to authenticated
  using (
    ustaz_id = auth.uid()
    or public.current_role() in ('admin', 'director')
  );

drop policy if exists "ustazes create own attendance" on public.attendance_records;
create policy "ustazes create own attendance"
  on public.attendance_records for insert to authenticated
  with check (
    ustaz_id = auth.uid()
    and marked_by = auth.uid()
    and public.current_role() = 'ustaz'
  );

drop policy if exists "ustazes update own attendance" on public.attendance_records;
create policy "ustazes update own attendance"
  on public.attendance_records for update to authenticated
  using (ustaz_id = auth.uid() and public.current_role() = 'ustaz')
  with check (ustaz_id = auth.uid() and marked_by = auth.uid() and public.current_role() = 'ustaz');

drop policy if exists "ustazes delete own attendance" on public.attendance_records;
create policy "ustazes delete own attendance"
  on public.attendance_records for delete to authenticated
  using (ustaz_id = auth.uid() and public.current_role() = 'ustaz');

grant select, insert, update, delete on table public.attendance_records to authenticated;

create table if not exists public.attendance_permissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  absence_date date not null,
  parent_name text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  response_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_permissions_status_date_idx
  on public.attendance_permissions (status, absence_date);
create index if not exists attendance_permissions_student_idx
  on public.attendance_permissions (student_id, absence_date);

alter table public.attendance_permissions enable row level security;

drop policy if exists "permissions visible to permitted users" on public.attendance_permissions;
create policy "permissions visible to permitted users"
  on public.attendance_permissions for select to authenticated
  using (ustaz_id = auth.uid() or public.current_role() in ('admin', 'director'));

drop policy if exists "ustazes create permission requests" on public.attendance_permissions;
create policy "ustazes create permission requests"
  on public.attendance_permissions for insert to authenticated
  with check (ustaz_id = auth.uid() and public.current_role() = 'ustaz');

drop policy if exists "directors manage permissions" on public.attendance_permissions;
create policy "directors manage permissions"
  on public.attendance_permissions for update to authenticated
  using (public.current_role() in ('admin', 'director'))
  with check (public.current_role() in ('admin', 'director'));

grant select, insert, update on table public.attendance_permissions to authenticated;
