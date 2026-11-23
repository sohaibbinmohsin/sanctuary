alter table public.treatments
  add column if not exists vaccine text;

alter table public.treatments
  drop constraint if exists treatments_treatment_type_check;

alter table public.treatments
  add constraint treatments_treatment_type_check
  check (
    treatment_type in (
      'meds',
      'vet',
      'procedure',
      'other',
      'intake',
      'arrived',
      'status',
      'vaccination'
    )
  );

alter table public.treatments
  drop constraint if exists treatments_vaccine_check;

alter table public.treatments
  add constraint treatments_vaccine_check
  check (
    (
      treatment_type = 'vaccination'
      and vaccine is not null
      and length(btrim(vaccine)) > 0
    )
    or (
      treatment_type <> 'vaccination'
      and vaccine is null
    )
  );