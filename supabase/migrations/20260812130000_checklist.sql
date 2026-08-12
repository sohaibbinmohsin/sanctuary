create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id),
  unique (org_id, animal_id),
  foreign key (animal_id, org_id)
    references animals(id, org_id) on delete cascade
);

create index checklist_items_by_org on checklist_items (org_id);
create index checklist_items_by_animal on checklist_items (animal_id);

create table checklist_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null,
  check_date date not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id),
  unique (org_id, animal_id, check_date),
  foreign key (animal_id, org_id)
    references animals(id, org_id) on delete cascade
);

create index checklist_checks_by_org on checklist_checks (org_id);
create index checklist_checks_by_animal_date
  on checklist_checks (animal_id, check_date);

alter table checklist_items enable row level security;
alter table checklist_checks enable row level security;

create policy checklist_items_all on checklist_items for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy checklist_checks_all on checklist_checks for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter publication powersync add table checklist_items;
alter publication powersync add table checklist_checks;
