-- supabase/migrations/20260902010000_ledger_entry_currency.sql
alter table ledger_entries
  add column if not exists currency text not null default 'PKR'
  check (currency in ('PKR', 'USD'));
