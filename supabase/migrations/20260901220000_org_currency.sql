-- supabase/migrations/20260901220000_org_currency.sql
alter table organizations
  add column if not exists currency text not null default 'PKR'
  check (currency in ('PKR', 'USD'));
