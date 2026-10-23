-- Animal statuses are now strictly 1:1 via animals.status_id.
-- Backfill any missing animals.status_id from animal_status_assignments if any remain,
-- then drop the legacy animal_status_assignments junction table.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'animal_status_assignments'
  ) then
    update public.animals a
    set status_id = sub.status_id
    from (
      select distinct on (asa.animal_id)
        asa.animal_id,
        asa.status_id
      from public.animal_status_assignments asa
      order by asa.animal_id, asa.created_at desc
    ) sub
    where a.id = sub.animal_id
      and a.status_id is null;
  end if;
end $$;

drop table if exists public.animal_status_assignments cascade;
