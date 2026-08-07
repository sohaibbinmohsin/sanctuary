-- supabase/seed.sql
-- Prefer: npm run db:setup (uses random org UUID + SEED_USER_ID from .env.local)
-- Manual fallback: replace :user_id, then run in SQL Editor.

insert into organizations (name, initials)
select 'Tales of Second Chances', 'TOSC'
where not exists (
  select 1 from organizations
  where name = 'Tales of Second Chances' or initials = 'TOSC'
);

insert into org_members (org_id, user_id, role)
select o.id, ':user_id'::uuid, 'admin'
from organizations o
where (o.name = 'Tales of Second Chances' or o.initials = 'TOSC')
  and not exists (
    select 1 from org_members m
    where m.org_id = o.id and m.user_id = ':user_id'::uuid
  );

insert into animal_statuses (org_id, label, sort_order, counts_as_in_care)
select o.id, s.label, s.sort_order, s.counts_as_in_care
from organizations o
cross join (
  values
    ('Intake', 1, true),
    ('Quarantine', 2, true),
    ('Treatment', 3, true),
    ('In sanctuary', 4, true),
    ('Transferred', 5, false),
    ('Deceased', 6, false),
    ('Adopted', 7, false)
) as s(label, sort_order, counts_as_in_care)
where o.name = 'Tales of Second Chances' or o.initials = 'TOSC'
  and not exists (
    select 1 from animal_statuses a
    where a.org_id = o.id and a.label = s.label
  );

insert into ledger_categories (org_id, label, direction)
select o.id, c.label, c.direction
from organizations o
cross join (
  values
    ('Donation', 'in'),
    ('Medical', 'out'),
    ('Food', 'out'),
    ('Supplies', 'out')
) as c(label, direction)
where o.name = 'Tales of Second Chances' or o.initials = 'TOSC'
  and not exists (
    select 1 from ledger_categories lc
    where lc.org_id = o.id and lc.label = c.label
  );
