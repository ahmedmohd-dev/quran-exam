create or replace function public.save_examiner_ustaz_links(
  p_examiner_id uuid,
  p_ustaz_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_total integer := 0;
begin
  if (select public.current_role()) <> 'admin' then
    raise exception 'Only the Exam Admin can change Examiner connections.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_examiner_id and role = 'examiner' and active = true
  ) then
    raise exception 'The selected account must be an active Examiner account.';
  end if;

  if coalesce(array_length(p_ustaz_ids, 1), 0) = 0 then
    raise exception 'Select at least one connected Ustaz.';
  end if;

  if exists (
    select 1
    from unnest(p_ustaz_ids) as selected_ustaz(id)
    left join public.profiles profile on profile.id = selected_ustaz.id
    where profile.id is null or profile.role <> 'ustaz' or profile.active is not true
  ) then
    raise exception 'Every connected account must be an active Ustaz.';
  end if;

  delete from public.examiner_ustaz_links where examiner_id = p_examiner_id;

  delete from public.examiner_ustaz_links
  where ustaz_id = any(p_ustaz_ids) and examiner_id <> p_examiner_id;

  insert into public.examiner_ustaz_links (examiner_id, ustaz_id, created_by)
  select p_examiner_id, selected_ustaz.id, (select auth.uid())
  from (
    select distinct id from unnest(p_ustaz_ids) as requested(id)
  ) as selected_ustaz
  on conflict (examiner_id, ustaz_id)
  do update set created_by = excluded.created_by, created_at = now();

  get diagnostics saved_total = row_count;
  return saved_total;
end;
$$;

revoke all on function public.save_examiner_ustaz_links(uuid, uuid[]) from public;
grant execute on function public.save_examiner_ustaz_links(uuid, uuid[]) to authenticated;
