-- supabase/migrations/001_initial_schema.sql
create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  created_at timestamptz not null default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'volunteer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table animal_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  sort_order int not null,
  counts_as_in_care boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table animals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  shelter_code text not null,
  name text,
  species text not null,
  sex text,
  markings text,
  intake_date date not null default (current_date),
  status_id uuid not null references animal_statuses(id),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, shelter_code)
);

create table treatments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  treated_at timestamptz not null default now(),
  treatment_type text not null check (treatment_type in ('meds', 'vet', 'procedure', 'other', 'intake', 'arrived', 'status')),
  notes text,
  ledger_entry_id uuid,
  created_at timestamptz not null default now()
);

create table ledger_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  direction text not null check (direction in ('in', 'out')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category_id uuid not null references ledger_categories(id),
  direction text not null check (direction in ('in', 'out')),
  amount_cents bigint not null check (amount_cents > 0),
  entry_date date not null default (current_date),
  notes text,
  animal_id uuid references animals(id),
  created_at timestamptz not null default now()
);

alter table treatments
  add constraint treatments_ledger_entry_id_fkey
  foreign key (ledger_entry_id) references ledger_entries(id);

create table photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  r2_key text,
  local_only boolean not null default true,
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

-- Helper: current user's org ids
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from org_members where user_id = auth.uid();
$$;

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table animal_statuses enable row level security;
alter table animals enable row level security;
alter table treatments enable row level security;
alter table ledger_categories enable row level security;
alter table ledger_entries enable row level security;
alter table photos enable row level security;

create policy org_select on organizations for select
  using (id in (select public.user_org_ids()));

create policy members_select on org_members for select
  using (org_id in (select public.user_org_ids()));

create policy statuses_all on animal_statuses for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy animals_all on animals for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy treatments_all on treatments for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy ledger_categories_all on ledger_categories for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy ledger_entries_all on ledger_entries for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy photos_all on photos for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- PowerSync publication (adjust per PowerSync Supabase guide if names differ)
create publication powersync for table
  organizations, org_members, animal_statuses, animals,
  treatments, ledger_categories, ledger_entries, photos;
