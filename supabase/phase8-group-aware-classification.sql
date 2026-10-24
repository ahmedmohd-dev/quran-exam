alter table public.exam_period_big_ustazes
  add column if not exists exam_group_id uuid references public.exam_groups(id) on delete cascade;

alter table public.exam_assignment_groups
  add column if not exists exam_group_id uuid references public.exam_groups(id) on delete cascade;

update public.exam_period_big_ustazes big
set exam_group_id = groups.id
from public.exam_groups groups
where groups.code = 'boys' and big.exam_group_id is null;

update public.exam_assignment_groups ranges
set exam_group_id = groups.id
from public.exam_groups groups
where groups.code = 'boys' and ranges.exam_group_id is null;

create index if not exists exam_period_big_ustazes_group_idx
  on public.exam_period_big_ustazes (exam_period_id, exam_group_id);

create index if not exists exam_assignment_groups_group_idx
  on public.exam_assignment_groups (exam_period_id, exam_group_id, group_order);
