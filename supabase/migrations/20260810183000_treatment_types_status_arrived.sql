-- Allow system care-log types used by the app (arrival + status changes).
alter table treatments
  drop constraint if exists treatments_treatment_type_check;

alter table treatments
  add constraint treatments_treatment_type_check
  check (
    treatment_type in (
      'meds',
      'vet',
      'procedure',
      'other',
      'intake',
      'arrived',
      'status'
    )
  );
