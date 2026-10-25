-- Add archived column to rescue_reports for soft-delete
alter table public.rescue_reports
  add column if not exists archived boolean not null default false;

create index if not exists idx_rescue_reports_archived on public.rescue_reports(archived);
