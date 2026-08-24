create index if not exists exam_results_period_status_idx
  on public.exam_results (exam_period_id, status);

create index if not exists profiles_role_active_idx
  on public.profiles (role, active, full_name);
