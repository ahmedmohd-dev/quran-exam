-- Alif-Qur'an students take Alif questions in rounds 1–2 and Qur'an questions in round 3.
-- This changes only future inserts/updates; no existing result data is rewritten.
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
  if jsonb_typeof(new.makhraj_scores) <> 'array' or jsonb_array_length(new.makhraj_scores) <> expected_rounds then raise exception 'Enter all required Makhraj and Sifa scores.'; end if;

  for round_index in 0..expected_rounds - 1 loop
    round_item := new.round_scores -> round_index;
    if jsonb_typeof(round_item) <> 'array' or jsonb_array_length(round_item) <> 8 then raise exception 'Each round must have exactly 8 questions.'; end if;
    for question_index in 0..7 loop
      question_item := round_item -> question_index;
      if expected_scheme in ('quran_67_89', 'quran_47_66', 'quran_36_46', 'quran_1_35')
        or (expected_scheme = 'alif_quran_90_114' and round_index = 2) then
        score := coalesce((question_item ->> 'mistakes')::numeric, 0); if score < 0 or score > 5 then raise exception 'Invalid mistakes score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'tajweed')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid tajweed score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'hesitation')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid hesitation score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'surahName')::numeric, 0); if score < 0 or score > 1 then raise exception 'Invalid Surah name score.'; end if; raw_question_total := raw_question_total + score;
      else
        score := coalesce((question_item ->> 'fluency')::numeric, 0); if score < 0 or score > 4 then raise exception 'Invalid fluency score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'speed')::numeric, 0); if score < 0 or score > 4 then raise exception 'Invalid speed score.'; end if; raw_question_total := raw_question_total + score;
        score := coalesce((question_item ->> 'hesitation')::numeric, 0); if score < 0 or score > 2 then raise exception 'Invalid hesitation score.'; end if; raw_question_total := raw_question_total + score;
      end if;
    end loop;
    score := coalesce((new.makhraj_scores ->> round_index)::numeric, 0);
    if score < 0 or score > expected_makhraj[round_index + 1] then raise exception 'Invalid Makhraj and Sifa score.'; end if;
    raw_makhraj_total := raw_makhraj_total + score;
  end loop;

  new.question_total := round(raw_question_total * 80 / (expected_rounds * 80), 2);
  new.makhraj_total := round(raw_makhraj_total, 2);
  new.total_mark := new.question_total + new.makhraj_total;
  new.result_class := case when new.total_mark >= 80 then 'first' when new.total_mark >= 60 then 'second' when new.total_mark >= 40 then 'third' else 'fourth' end;
  new.next_action := case new.result_class when 'first' then 'Passed — no revision required.' when 'second' then 'Revision required — select a revision destination.' else 'Further revision required.' end;
  new.updated_at := now();
  return new;
end;
$$;
