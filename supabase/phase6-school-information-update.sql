alter table public.ustaz_school_students
  drop constraint if exists ustaz_school_students_school_type_check;

alter table public.ustaz_school_students
  add constraint ustaz_school_students_school_type_check
  check (school_type in ('public', 'private', 'not_studying'));

alter table public.ustaz_school_students
  add column if not exists learning_place_type text,
  add column if not exists learning_place_number integer,
  add column if not exists quran_level text;

alter table public.ustaz_school_students
  drop constraint if exists ustaz_school_students_learning_place_type_check;

alter table public.ustaz_school_students
  add constraint ustaz_school_students_learning_place_type_check
  check (learning_place_type in ('qaida_nuraniya', 'qaida_baghdadiya', 'quran'));

alter table public.ustaz_school_students
  drop constraint if exists ustaz_school_students_learning_place_number_check;

alter table public.ustaz_school_students
  add constraint ustaz_school_students_learning_place_number_check
  check (learning_place_number between 1 and 114);

alter table public.ustaz_school_students
  drop constraint if exists ustaz_school_students_quran_level_check;

alter table public.ustaz_school_students
  add constraint ustaz_school_students_quran_level_check
  check (quran_level in ('beginner', 'intermediate', 'advanced'));
