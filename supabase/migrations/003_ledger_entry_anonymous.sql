-- Anonymous donations: public page can show proof screenshots without naming the donor.

alter table ledger_entries
  add column if not exists is_anonymous boolean not null default false;
