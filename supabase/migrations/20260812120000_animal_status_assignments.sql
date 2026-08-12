-- supabase/migrations/20260812120000_animal_status_assignments.sql
create table animal_status_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  status_id uuid not null references animal_statuses(id),
  created_at timestamptz not null default now(),
  unique (animal_id, status_id)
);

create index animal_status_assignments_by_org on animal_status_assignments (org_id);
create index animal_status_assignments_by_animal on animal_status_assignments (animal_id);
create index animal_status_assignments_by_status on animal_status_assignments (status_id);

insert into animal_status_assignments (org_id, animal_id, status_id, created_at)
select a.org_id, a.id, a.status_id, coalesce(a.updated_at, a.created_at, now())
from animals a
where a.status_id is not null
on conflict (animal_id, status_id) do nothing;

alter table animal_status_assignments enable row level security;

create policy animal_status_assignments_all on animal_status_assignments for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- Keep animals.status_id NOT NULL as denormalized primary (do not drop).
