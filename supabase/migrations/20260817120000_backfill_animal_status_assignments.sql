-- Animals created after 20260812120000 (or by a client that only wrote
-- animals.status_id) can be missing assignment rows. The original migration
-- is not re-runnable (CREATE TABLE). This backfill is idempotent.

insert into animal_status_assignments (org_id, animal_id, status_id, created_at)
select a.org_id, a.id, a.status_id, coalesce(a.updated_at, a.created_at, now())
from animals a
join animal_statuses s
  on s.id = a.status_id
 and s.org_id = a.org_id
where a.status_id is not null
on conflict (animal_id, status_id) do nothing;
