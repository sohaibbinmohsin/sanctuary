-- Ensure all organizations have a default 'Intake' animal status and a default 'Food' ledger category.
-- 1. Update the handle_new_user_org trigger function so future registered organizations automatically get them.

create or replace function public.handle_new_user_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name, initials, setup_completed)
  values ('My Shelter', 'MS', false)
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, new.id, 'admin');

  -- Default Intake status
  insert into public.animal_statuses (org_id, label, sort_order, counts_as_in_care, archived)
  values (new_org_id, 'Intake', 1, true, false);

  -- Default Food category
  insert into public.ledger_categories (org_id, label, direction, archived)
  values (new_org_id, 'Food', 'out', false);

  return new;
end;
$$;

-- 2. Backfill existing organizations that have no animal_statuses with 'Intake'
insert into public.animal_statuses (org_id, label, sort_order, counts_as_in_care, archived)
select o.id, 'Intake', 1, true, false
from public.organizations o
where not exists (
  select 1 from public.animal_statuses s where s.org_id = o.id
);

-- 3. Backfill existing organizations that have no ledger_categories with 'Food'
insert into public.ledger_categories (org_id, label, direction, archived)
select o.id, 'Food', 'out', false
from public.organizations o
where not exists (
  select 1 from public.ledger_categories c where c.org_id = o.id
);
