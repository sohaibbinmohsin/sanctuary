-- supabase/seed.sql
-- Replace :user_id with auth.users id after signup

insert into organizations (id, name, initials)
values ('11111111-1111-1111-1111-111111111111', 'Tales of Second Chances', 'TOSC');

insert into org_members (org_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', :user_id, 'admin');

insert into animal_statuses (org_id, label, sort_order, counts_as_in_care) values
  ('11111111-1111-1111-1111-111111111111', 'Intake', 1, true),
  ('11111111-1111-1111-1111-111111111111', 'Quarantine', 2, true),
  ('11111111-1111-1111-1111-111111111111', 'Treatment', 3, true),
  ('11111111-1111-1111-1111-111111111111', 'In sanctuary', 4, true),
  ('11111111-1111-1111-1111-111111111111', 'Transferred', 5, false),
  ('11111111-1111-1111-1111-111111111111', 'Deceased', 6, false),
  ('11111111-1111-1111-1111-111111111111', 'Adopted', 7, false);

insert into ledger_categories (org_id, label, direction) values
  ('11111111-1111-1111-1111-111111111111', 'Donation', 'in'),
  ('11111111-1111-1111-1111-111111111111', 'Medical', 'out'),
  ('11111111-1111-1111-1111-111111111111', 'Food', 'out'),
  ('11111111-1111-1111-1111-111111111111', 'Supplies', 'out');
