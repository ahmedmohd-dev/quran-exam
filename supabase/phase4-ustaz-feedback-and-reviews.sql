create table if not exists public.ustaz_result_comments (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null default '',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (exam_period_id, ustaz_id)
);

create table if not exists public.ustaz_exam_feedback (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) >= 3),
  created_at timestamptz not null default now()
);

create table if not exists public.result_review_requests (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  ustaz_id uuid not null references public.profiles(id) on delete cascade,
  student_registration_id uuid not null references public.student_registrations(id) on delete cascade,
  request_message text not null check (char_length(trim(request_message)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_period_id, ustaz_id, student_registration_id)
);

create index if not exists ustaz_exam_feedback_period_idx on public.ustaz_exam_feedback (exam_period_id, created_at desc);
create index if not exists result_review_requests_period_status_idx on public.result_review_requests (exam_period_id, status, created_at desc);

alter table public.ustaz_result_comments enable row level security;
alter table public.ustaz_exam_feedback enable row level security;
alter table public.result_review_requests enable row level security;

drop policy if exists "ustazes read own result comments" on public.ustaz_result_comments;
create policy "ustazes read own result comments" on public.ustaz_result_comments for select to authenticated using (public.current_role() = 'ustaz' and ustaz_id = auth.uid());
drop policy if exists "leaders manage result comments" on public.ustaz_result_comments;
create policy "leaders manage result comments" on public.ustaz_result_comments for all to authenticated using (public.current_role() in ('admin', 'director')) with check (public.current_role() in ('admin', 'director'));

drop policy if exists "ustazes create own exam feedback" on public.ustaz_exam_feedback;
create policy "ustazes create own exam feedback" on public.ustaz_exam_feedback for insert to authenticated with check (public.current_role() = 'ustaz' and ustaz_id = auth.uid());
drop policy if exists "leaders read exam feedback" on public.ustaz_exam_feedback;
create policy "leaders read exam feedback" on public.ustaz_exam_feedback for select to authenticated using (public.current_role() in ('admin', 'director'));

drop policy if exists "ustazes manage own review requests" on public.result_review_requests;
create policy "ustazes manage own review requests" on public.result_review_requests for all to authenticated using (public.current_role() = 'ustaz' and ustaz_id = auth.uid()) with check (public.current_role() = 'ustaz' and ustaz_id = auth.uid());
drop policy if exists "leaders manage review requests" on public.result_review_requests;
create policy "leaders manage review requests" on public.result_review_requests for all to authenticated using (public.current_role() in ('admin', 'director')) with check (public.current_role() in ('admin', 'director'));

grant select, insert, update, delete on public.ustaz_result_comments, public.ustaz_exam_feedback, public.result_review_requests to authenticated;
