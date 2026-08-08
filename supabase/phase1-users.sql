alter table public.profiles
  add column if not exists username text unique;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9._-]{3,32}$') not valid;

alter table public.profiles
  validate constraint profiles_username_format;
