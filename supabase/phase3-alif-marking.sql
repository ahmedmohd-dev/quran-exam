create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_period_id uuid not null references public.exam_periods(id) on delete cascade,
  examiner_assignment_id uuid not null unique references public.examiner_assignments(id) on delete cascade,
  student_registration_id uuid not null references public.student_registrations(id) on delete cascade,
  examiner_id uuid not null references public.profiles(id) on delete restrict,
  marking_scheme text not null check (marking_scheme in ('alif_1_17', 'alif_18_27', 'alif_quran_90_114', 'quran_67_89', 'quran_47_66', 'quran_36_46', 'quran_1_35')),
  round_scores jsonb not null default '[]'::jsonb,
  makhraj_scores jsonb not null default '[]'::jsonb,
  question_total numeric(5,2) not null default 0,
  makhraj_total numeric(5,2) not null default 0,
  total_mark numeric(5,2) not null default 0,
  result_class text not null default 'fourth' check (result_class in ('first', 'second', 'third', 'fourth')),
  examiner_comment text,
  revision_place integer,
  next_action text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_results_examiner_period_idx
  on public.exam_results (examiner_id, exam_period_id);

alter table public.exam_results
  drop constraint if exists exam_results_marking_scheme_check;
alter table public.exam_results
  add constraint exam_results_marking_scheme_check
  check (marking_scheme in ('alif_1_17', 'alif_18_27', 'alif_quran_90_114', 'quran_67_89', 'quran_47_66', 'quran_36_46', 'quran_1_35));

alter table public.exam_results enable row level security;

drop policy if exists "admins manage exam results" on public.exam_results;
create policy "admins manage exam results"
on public.exam_results
for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "examiners manage their assigned results" on public.exam_results;
create policy "examiners manage their assigned results"
on public.exam_results
for all
to authenticated
using (
  examiner_id = (select auth.uid())
  and exists (
    select 1 from public.examiner_assignments assignment
    where assignment.id = exam_results.examiner_assignment_id
      and assignment.examiner_id = (select auth.uid())
      and assignment.student_registration_id = exam_results.student_registration_id
  )
)
with check (
  examiner_id = (select auth.uid())
  and exists (
    select 1 from public.examiner_assignments assignment
    where assignment.id = exam_results.examiner_assignment_id
      and assignment.examiner_id = (select auth.uid())
      and assignment.student_registration_id = exam_results.student_registration_id
  )
);

create or replace function public.calculate_alif_exam_result()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  registration_level public.learning_level;
  registration_place integer;
  expected_scheme text;
  expected_rounds integer;
  expected_makhraj numeric[];
  round_item jsonb;
  question_item jsonb;
  round_index integer;
  question_index integer;
  raw_question_total numeric := 0;
  raw_makhraj_total numeric := 0;
  score numeric;
  max_score numeric;
begin
  select registration.current_learning_level, registration.current_learning_place::integer
  into registration_level, registration_place
  from public.student_registrations registration
  where registration.id = new.student_registration_id;

  if registration_level = 'alif' and registration_place between 1 and 17 then
    expected_scheme := 'alif_1_17'; expected_rounds := 1; expected_makhraj := array[20::numeric];
  elsif registration_level = 'alif' and registration_place between 18 and 27 then
    expected_scheme := 'alif_18_27'; expected_rounds := 2; expected_makhraj := array[10::numeric, 10::numeric];
  elsif registration_level = 'quran' and registration_place between 90 and 114 then
    expected_scheme := 'alif_quran_90_114'; expected_rounds := 3; expected_makhraj := array[5::numeric, 5::numeric, 10::numeric];
  elsif registration_level = 'quran' and registration_place between 67 and 89 then
    expected_scheme := 'quran_67_89'; expected_rounds := 2; expected_makhraj := array[10::numeric, 10::numeric];
  elsif registration_level = 'quran' and registration_place between 47 and 66 then
    expected_scheme := 'quran_47_66'; expected_rounds := 3; expected_makhraj := array[6::numeric, 7::numeric, 7::numeric];
  elsif registration_level = 'quran' and registration_place between 36 and 46 then
    expected_scheme := 'quran_36_46'; expected_rounds := 4; expected_makhraj := array[5::numeric, 5::numeric, 5::numeric, 5::numeric];
  elsif registration_level = 'quran' and registration_place between 1 and 35 then
    expected_scheme := 'quran_1_35'; expected_rounds := 5; expected_makhraj := array[4::numeric, 4::numeric, 4::numeric, 4::numeric, 4::numeric];
  else
    raise exception 'This student does not yet have an available Phase 3 marking scheme.';
  end if;

  if new.marking_scheme <> expected_scheme then raise exception 'The marking scheme does not match this student.'; end if;
  if jsonb_typeof(new.round_scores) <> 'array' or jsonb_array_length(new.round_scores) <> expected_rounds then raise exception 'Enter all required rounds.'; end if;
  if jsonb_typeof(new.makhraj_scores) <> 'array' or jsonb_array_length(new.makhraj_scores) <> expected_rounds then raise exception 'Enter all መኸረጅ እና ሲፋ scores.'; end if;

  for round_index in 0..expected_rounds - 1 loop
    round_item := new.round_scores -> round_index;
    if jsonb_typeof(round_item) <> 'array' or jsonb_array_length(round_item) <> 8 then raise exception 'Each round must have exactly 8 questions.'; end if;
    for question_index in 0..7 loop
      question_item := round_item -> question_index;
      if expected_scheme in ('quran_67_89', 'quran_47_66', 'quran_36_46', 'quran_1_35')
        or (expected_scheme = 'alif_quran_90_114' and round_index = 2) then
        score := coalesce((question_item ->> 'mistakes')::numeric, 0); if score < 0 or score > 5 then raise exception 'Invalid ስህተት score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'tajweed')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid tajweed score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'hesitation')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid መንተባተብ score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'surahName')::numeric, 0); if score < 0 or score > 1 then raise exception 'Invalid የሱራ ስም score.'; end if; raw_question_total := raw_question_total + score;
      else
        score := coalesce((question_item ->> 'fluency')::numeric, 0); if score < 0 or score > 4 then raise exception 'Invalid በማፋገጥ score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'speed')::numeric, 0); if score < 0 or score > 4 then raise exception 'Invalid በሽምደዳ score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'hesitation')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid መንተባተብ score.'; end if; raw_question_total := raw_question_total + score;
      end if;
    end loop;
    score := coalesce((new.makhraj_scores ->> round_index)::numeric, 0);
    if score < 0 or score > expected_makhraj[round_index + 1] then raise exception 'Invalid መኸረጅ እና ሲፋ score.'; end if;
    raw_makhraj_total := raw_makhraj_total + score;
  end loop;

  new.question_total := round(raw_question_total * 80 / (expected_rounds * 80), 2);
  new.makhraj_total := round(raw_makhraj_total, 2);
  new.total_mark := new.question_total + new.makhraj_total;
  new.result_class := case when new.total_mark >= 80 then 'first' when new.total_mark >= 60 then 'second' when new.total_mark >= 40 then 'third' else 'fourth' end;
  new.next_action := case new.result_class when 'first' then 'Passed — no revision required.' when 'second' then 'Revision required — the Ustaz will choose the revision Fesel.' else 'Must restart from the beginning of Qaida Nuraniya.' end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists calculate_alif_exam_result on public.exam_results;
create trigger calculate_alif_exam_result
before insert or update on public.exam_results
for each row execute function public.calculate_alif_exam_result();

grant select, insert, update on public.exam_results to authenticated;
