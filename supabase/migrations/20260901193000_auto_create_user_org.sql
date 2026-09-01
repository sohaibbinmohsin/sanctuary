-- Auto-create an organization for newly registered users and assign them as admin with setup_completed = false

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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_org on auth.users;
create trigger on_auth_user_created_org
  after insert on auth.users
  for each row execute function public.handle_new_user_org();

-- Backfill any existing auth users who do not have an organization membership yet
do $$
declare
  u record;
  new_org_id uuid;
begin
  for u in 
    select id from auth.users 
    where id not in (select user_id from public.org_members)
  loop
    insert into public.organizations (name, initials, setup_completed)
    values ('My Shelter', 'MS', false)
    returning id into new_org_id;

    insert into public.org_members (org_id, user_id, role)
    values (new_org_id, u.id, 'admin');
  end loop;
end $$;

-- Allow authenticated users to insert organizations and members
drop policy if exists org_insert on organizations;
create policy org_insert on organizations for insert
  with check (auth.uid() is not null);

drop policy if exists members_insert on org_members;
create policy members_insert on org_members for insert
  with check (user_id = auth.uid());

