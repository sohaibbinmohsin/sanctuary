-- Null years and null months together mean unknown.
alter table public.animals
  add column if not exists age_years integer,
  add column if not exists age_months integer;

alter table public.animals
  drop constraint if exists animals_age_pair_check;

alter table public.animals
  add constraint animals_age_pair_check
  check (
    (age_years is null and age_months is null)
    or (
      age_years between 0 and 20
      and age_months between 0 and 11
    )
  );