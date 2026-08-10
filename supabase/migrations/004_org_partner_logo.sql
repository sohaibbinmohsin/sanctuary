-- Partner logo on Overview share images (R2 object key / public URL).
alter table organizations
  add column if not exists logo_r2_key text;

-- Members can update their org branding (PowerSync upload uses the user JWT).
drop policy if exists org_update on organizations;
create policy org_update on organizations for update
  using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));
