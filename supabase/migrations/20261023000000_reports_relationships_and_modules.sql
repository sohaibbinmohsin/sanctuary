-- supabase/migrations/20261023000000_reports_relationships_and_modules.sql
-- 1. Extend organizations with enabled_modules
alter table public.organizations
  add column if not exists enabled_modules text;

-- 2. Extend animals with life_stage
alter table public.animals
  add column if not exists life_stage text
  check (life_stage in ('adult', 'child'));

-- 3. Create animal_relationships table
create table if not exists public.animal_relationships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  related_animal_id uuid not null references public.animals(id) on delete cascade,
  relationship_type text not null
    check (relationship_type in ('bonded', 'mother', 'child', 'sibling', 'incompatible')),
  notes text,
  created_at timestamptz not null default now(),
  unique (animal_id, related_animal_id)
);

create index if not exists idx_animal_rel_org on public.animal_relationships(org_id);
create index if not exists idx_animal_rel_animal on public.animal_relationships(animal_id);
create index if not exists idx_animal_rel_related on public.animal_relationships(related_animal_id);

-- 4. Create rescue_reports table
create table if not exists public.rescue_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_number text not null,
  category text not null,
  species text not null,
  chief_complaint text not null,
  status text not null,
  location_area text,
  location_landmark text,
  city text,
  latitude double precision,
  longitude double precision,
  life_stage text,
  reporter_name text,
  reporter_phone text,
  reporter_cnic text,
  transport_type text,
  disposition_type text,
  animal_id uuid references public.animals(id) on delete set null,
  legal_notes text,
  dismissal_reason text,
  stage_logged_at timestamptz,
  stage_accepted_at timestamptz,
  stage_dispatched_at timestamptz,
  stage_attended_at timestamptz,
  intake_source text,
  animal_count integer default 1,
  group_breakdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rescue_reports_org on public.rescue_reports(org_id);
create index if not exists idx_rescue_reports_status on public.rescue_reports(status);
create index if not exists idx_rescue_reports_animal on public.rescue_reports(animal_id);

-- 5. Create report_photos table
create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.rescue_reports(id) on delete cascade,
  r2_key text,
  local_only boolean not null default true,
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_report_photos_report on public.report_photos(report_id);
create index if not exists idx_report_photos_org on public.report_photos(org_id);

-- 6. Enable Row Level Security (RLS)
alter table public.animal_relationships enable row level security;
alter table public.rescue_reports enable row level security;
alter table public.report_photos enable row level security;

-- 7. Add Multi-Tenant RLS Policies
drop policy if exists animal_relationships_all on public.animal_relationships;
create policy animal_relationships_all on public.animal_relationships for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists rescue_reports_all on public.rescue_reports;
create policy rescue_reports_all on public.rescue_reports for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists report_photos_all on public.report_photos;
create policy report_photos_all on public.report_photos for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- 8. Add to PowerSync Logical Replication Publication
alter publication powersync add table
  public.animal_relationships,
  public.rescue_reports,
  public.report_photos;
