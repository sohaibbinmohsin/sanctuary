alter table organizations
  add column if not exists setup_completed boolean not null default false;

update organizations
set setup_completed = true
where setup_completed is false;
