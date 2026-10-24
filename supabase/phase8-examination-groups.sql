create table if not exists public.exam_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('boys', 'girls')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.exam_groups (code, name)
values ('boys', 'Boys'), ('girls', 'Girls')
on conflict (code) do update set name = excluded.name;

create table if not exists public.exam_period_groups (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  exam_group_id uuid not null references public.exam_groups(id) on delete restrict,
  quran_enabled boolean not null default true,
  hisnul_muslim_enabled boolean not null default true,
  homework_enabled boolean not null default true,
  quran_max_mark numeric not null default 80 check (quran_max_mark > 0),
  hisnul_muslim_max_mark numeric not null default 20 check (hisnul_muslim_max_mark >= 0),
  homework_max_mark numeric not null default 5 check (homework_max_mark >= 0),
  created_at timestamptz not null default now(),
  unique (exam_period_id, exam_group_id)
);

insert into public.exam_period_groups (exam_period_id, exam_group_id)
select ep.id, eg.id
from public.exam_periods ep
cross join public.exam_groups eg
where eg.code = 'boys'
on conflict (exam_period_id, exam_group_id) do nothing;

create table if not exists public.exam_group_memberships (
  id uuid primary key default gen_random_uuid(),
  exam_group_id uuid not null references public.exam_groups(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((profile_id is not null and student_id is null) or (profile_id is null and student_id is not null)),
  unique (exam_group_id, profile_id),
  unique (exam_group_id, student_id)
);

insert into public.exam_group_memberships (exam_group_id, profile_id)
select eg.id, p.id
from public.exam_groups eg
cross join public.profiles p
where eg.code = 'boys'
  and p.role in ('ustaz', 'examiner')
on conflict (exam_group_id, profile_id) do nothing;

insert into public.exam_group_memberships (exam_group_id, student_id)
select eg.id, s.id
from public.exam_groups eg
cross join public.students s
where eg.code = 'boys'
on conflict (exam_group_id, student_id) do nothing;

create index if not exists exam_period_groups_period_idx on public.exam_period_groups (exam_period_id);
create index if not exists exam_period_groups_group_idx on public.exam_period_groups (exam_group_id);
create index if not exists exam_group_memberships_profile_idx on public.exam_group_memberships (profile_id);
create index if not exists exam_group_memberships_student_idx on public.exam_group_memberships (student_id);

alter table public.exam_groups enable row level security;
alter table public.exam_period_groups enable row level security;
alter table public.exam_group_memberships enable row level security;

drop policy if exists "exam groups visible to authenticated users" on public.exam_groups;
create policy "exam groups visible to authenticated users"
  on public.exam_groups for select to authenticated using (active or public.current_role() in ('admin', 'director'));

drop policy if exists "period groups visible to authenticated users" on public.exam_period_groups;
create policy "period groups visible to authenticated users"
  on public.exam_period_groups for select to authenticated using (true);

drop policy if exists "group memberships visible to permitted users" on public.exam_group_memberships;
create policy "group memberships visible to permitted users"
  on public.exam_group_memberships for select to authenticated
  using (profile_id = auth.uid() or public.current_role() in ('admin', 'director'));

grant select on public.exam_groups, public.exam_period_groups, public.exam_group_memberships to authenticated;

insert into public.exam_period_groups (exam_period_id, exam_group_id, quran_enabled, hisnul_muslim_enabled, homework_enabled, quran_max_mark, hisnul_muslim_max_mark, homework_max_mark)
select ep.id, eg.id, true, false, false, 80, 0, 0
from (select id from public.exam_periods order by created_at desc limit 1) ep
cross join public.exam_groups eg
where eg.code = 'girls'
on conflict (exam_period_id, exam_group_id) do update set
  quran_enabled = excluded.quran_enabled,
  hisnul_muslim_enabled = excluded.hisnul_muslim_enabled,
  homework_enabled = excluded.homework_enabled,
  quran_max_mark = excluded.quran_max_mark,
  hisnul_muslim_max_mark = excluded.hisnul_muslim_max_mark,
  homework_max_mark = excluded.homework_max_mark;

create or replace function public.sync_student_exam_group_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select egm.exam_group_id into v_group_id
  from public.exam_group_memberships egm
  join public.profiles p on p.id = egm.profile_id
  where egm.profile_id = new.ustaz_id and p.role = 'ustaz'
  order by egm.created_at
  limit 1;

  if v_group_id is null then
    select id into v_group_id from public.exam_groups where code = 'boys' limit 1;
  end if;

  insert into public.exam_group_memberships (exam_group_id, student_id)
  values (v_group_id, new.student_id)
  on conflict (exam_group_id, student_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_student_exam_group_membership on public.student_registrations;
create trigger sync_student_exam_group_membership
after insert on public.student_registrations
for each row execute function public.sync_student_exam_group_membership();

create or replace function public.register_student(
  p_exam_period_id uuid,
  p_full_name text,
  p_registered_age integer,
  p_current_learning_level public.learning_level,
  p_current_learning_place text default null,
  p_class_group text default null,
  p_study_years integer default 0,
  p_study_months integer default 0,
  p_ustaz_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_student_number text;
  v_role public.user_role;
  v_ustaz_id uuid;
  v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to register a student.'; end if;
  select role into v_role from public.profiles where id = auth.uid() and active = true;
  if v_role not in ('admin', 'ustaz') then raise exception 'Your account cannot register students.'; end if;
  if v_role = 'ustaz' and p_ustaz_id is not null and p_ustaz_id <> auth.uid() then raise exception 'You cannot register a student for another Ustaz.'; end if;
  v_ustaz_id := case when v_role = 'admin' and p_ustaz_id is not null then p_ustaz_id else auth.uid() end;
  if not exists (select 1 from public.profiles where id = v_ustaz_id and role = 'ustaz' and active = true) then raise exception 'The selected Ustaz account is not active.'; end if;
  select egm.exam_group_id into v_group_id from public.exam_group_memberships egm where egm.profile_id = v_ustaz_id order by egm.created_at limit 1;
  if v_group_id is null then select id into v_group_id from public.exam_groups where code = 'boys' limit 1; end if;
  if not exists (select 1 from public.exam_period_groups where exam_period_id = p_exam_period_id and exam_group_id = v_group_id) then raise exception 'This examination group is not configured for the selected examination period.'; end if;
  if v_role = 'ustaz' and exists (select 1 from public.exam_periods where id = p_exam_period_id and ustaz_access_blocked = true) then raise exception 'Ustaz access is currently blocked by the Exam Admin.'; end if;
  if not exists (select 1 from public.exam_periods where id = p_exam_period_id and case registration_override when 'force_open' then true when 'force_closed' then false else ((registration_opens_at is null or registration_opens_at <= now()) and (registration_closes_at is null or registration_closes_at > now())) end) then raise exception 'Student registration is not open for this examination period.'; end if;
  if p_study_years not between 0 and 30 or p_study_months not between 0 and 11 then raise exception 'Invalid madrasa study duration.'; end if;
  v_student_number := 'QRE-' || lpad(nextval('public.student_number_sequence')::text, 5, '0');
  insert into public.students (student_number, full_name, created_by) values (v_student_number, trim(p_full_name), auth.uid()) returning id into v_student_id;
  insert into public.student_registrations (exam_period_id, student_id, ustaz_id, current_learning_level, current_learning_place, class_group, registered_age, study_years, study_months, registration_status)
  values (p_exam_period_id, v_student_id, v_ustaz_id, p_current_learning_level, nullif(trim(p_current_learning_place), ''), nullif(trim(p_class_group), ''), p_registered_age, p_study_years, p_study_months, 'complete');
  return v_student_id;
end;
$$;
