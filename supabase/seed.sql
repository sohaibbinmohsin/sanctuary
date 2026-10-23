-- supabase/seed.sql
-- Prefer: npm run db:setup (uses random org UUID + SEED_USER_ID from .env.local)
-- Manual fallback: replace :user_id, then run in SQL Editor.

do $$
declare
  seed_user uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
begin
  if not exists (select 1 from auth.users where id = seed_user) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      seed_user,
      'authenticated',
      'authenticated',
      'test@example.com',
      crypt('password123', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      seed_user,
      json_build_object('sub', seed_user::text, 'email', 'test@example.com'),
      'email',
      seed_user::text,
      now(),
      now(),
      now()
    );
  end if;

  insert into organizations (name, initials, setup_completed)
  select 'Test Shelter', 'TS', true
  where not exists (
    select 1 from organizations
    where name = 'Test Shelter' or initials = 'TS'
  );

  insert into org_members (org_id, user_id, role)
  select o.id, seed_user, 'admin'
  from organizations o
  where (o.name = 'Test Shelter' or o.initials = 'TS')
    and not exists (
      select 1 from org_members m
      where m.org_id = o.id and m.user_id = seed_user
    );

  delete from org_members
  where user_id = seed_user
    and org_id not in (
      select id from organizations
      where name = 'Test Shelter' or initials = 'TS'
    );
end $$;

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
where o.name = 'Test Shelter' or o.initials = 'TS'
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
where o.name = 'Test Shelter' or o.initials = 'TS'
  and not exists (
    select 1 from ledger_categories lc
    where lc.org_id = o.id and lc.label = c.label
  );
