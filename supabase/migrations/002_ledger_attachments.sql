-- Proof attachments for money (ledger) entries — images in R2, metadata synced via PowerSync.

create table ledger_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  ledger_entry_id uuid not null references ledger_entries(id) on delete cascade,
  r2_key text,
  local_only boolean not null default true,
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create index ledger_attachments_by_entry on ledger_attachments (ledger_entry_id);
create index ledger_attachments_by_state on ledger_attachments (upload_state);

alter table ledger_attachments enable row level security;

create policy ledger_attachments_all on ledger_attachments for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter publication powersync add table ledger_attachments;
