-- supabase/migrations/20260812120000_animal_status_assignments.sql
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'animals'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'animals'::regclass and attname = 'id'),
        (select attnum from pg_attribute where attrelid = 'animals'::regclass and attname = 'org_id')
      ]::smallint[]
  ) then
    alter table animals
      add constraint animals_id_org_id_key unique (id, org_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'animal_statuses'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'animal_statuses'::regclass and attname = 'id'),
        (select attnum from pg_attribute where attrelid = 'animal_statuses'::regclass and attname = 'org_id')
      ]::smallint[]
  ) then
    alter table animal_statuses
      add constraint animal_statuses_id_org_id_key unique (id, org_id);
  end if;
end
$$;

create table animal_status_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null,
  status_id uuid not null,
  created_at timestamptz not null default now(),
  unique (animal_id, status_id),
  foreign key (animal_id, org_id)
    references animals(id, org_id) on delete cascade,
  foreign key (status_id, org_id)
    references animal_statuses(id, org_id)
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

alter publication powersync add table animal_status_assignments;
