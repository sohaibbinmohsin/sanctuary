-- Org public page
alter table organizations
  add column if not exists public_enabled boolean not null default false,
  add column if not exists public_slug text;

create unique index if not exists organizations_public_slug_uidx
  on organizations (public_slug)
  where public_slug is not null;

-- Care / ledger visibility
alter table treatments
  add column if not exists hide_from_public boolean not null default false;

alter table ledger_entries
  add column if not exists hide_from_public boolean not null default false;

-- Animal photo attestation (clients may write capture_source; verified enforced below)
alter table photos
  add column if not exists capture_source text not null default 'gallery'
    check (capture_source in ('camera', 'gallery')),
  add column if not exists verified boolean not null default false;

-- Prevent clients from self-attesting verified via synced writes
create or replace function public.photos_enforce_verified()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false;
  elsif tg_op = 'UPDATE' then
    -- service_role bypasses RLS; detect via claim when available, else allow only
    -- verified changes that do not flip false→true from authenticated JWT role.
    if new.verified is distinct from old.verified then
      if current_setting('request.jwt.claim.role', true) = 'service_role'
         or current_user = 'service_role'
         or current_user = 'supabase_admin'
         or current_user = 'postgres' then
        return new;
      end if;
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists photos_enforce_verified_trg on photos;
create trigger photos_enforce_verified_trg
  before insert or update on photos
  for each row execute function public.photos_enforce_verified();

-- Capture sessions (Edge / service_role only — not in PowerSync)
create table if not exists photo_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  photo_id uuid references photos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table photo_capture_sessions enable row level security;
-- No policies for authenticated/anon — only service_role

-- Durable rate-limit buckets for Edge Functions
create table if not exists edge_rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  hit_count int not null default 0
);

alter table edge_rate_buckets enable row level security;
-- No client policies
