alter table public.animals
  add column if not exists sterilized text not null default 'unknown';

alter table public.animals
  drop constraint if exists animals_sterilized_check;

alter table public.animals
  add constraint animals_sterilized_check
  check (sterilized in ('yes', 'no', 'unknown'));