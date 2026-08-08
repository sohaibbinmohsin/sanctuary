import { column, Schema, Table } from '@powersync/web'

const organizations = new Table({
  name: column.text,
  initials: column.text,
  created_at: column.text,
})

const org_members = new Table(
  {
    org_id: column.text,
    user_id: column.text,
    role: column.text,
    created_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_org: ['org_id'] } },
)

const animal_statuses = new Table(
  {
    org_id: column.text,
    label: column.text,
    sort_order: column.integer,
    counts_as_in_care: column.integer,
    archived: column.integer,
    created_at: column.text,
  },
  { indexes: { by_org: ['org_id'] } },
)

const animals = new Table(
  {
    org_id: column.text,
    shelter_code: column.text,
    name: column.text,
    species: column.text,
    sex: column.text,
    markings: column.text,
    intake_date: column.text,
    status_id: column.text,
    notes: column.text,
    archived: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_org: ['org_id'], by_status: ['status_id'] } },
)

const treatments = new Table(
  {
    org_id: column.text,
    animal_id: column.text,
    treated_at: column.text,
    treatment_type: column.text,
    notes: column.text,
    ledger_entry_id: column.text,
    created_at: column.text,
  },
  { indexes: { by_animal: ['animal_id'], by_org: ['org_id'] } },
)

const ledger_categories = new Table(
  {
    org_id: column.text,
    label: column.text,
    direction: column.text,
    archived: column.integer,
    created_at: column.text,
  },
  { indexes: { by_org: ['org_id'] } },
)

const ledger_entries = new Table(
  {
    org_id: column.text,
    category_id: column.text,
    direction: column.text,
    amount_cents: column.integer,
    entry_date: column.text,
    notes: column.text,
    animal_id: column.text,
    created_at: column.text,
  },
  { indexes: { by_org: ['org_id'], by_animal: ['animal_id'] } },
)

const photos = new Table(
  {
    org_id: column.text,
    animal_id: column.text,
    r2_key: column.text,
    local_only: column.integer,
    upload_state: column.text,
    created_at: column.text,
  },
  { indexes: { by_animal: ['animal_id'], by_state: ['upload_state'] } },
)

export const AppSchema = new Schema({
  organizations,
  org_members,
  animal_statuses,
  animals,
  treatments,
  ledger_categories,
  ledger_entries,
  photos,
})

export type Database = (typeof AppSchema)['types']
export type OrganizationRecord = Database['organizations']
export type OrgMemberRecord = Database['org_members']
export type AnimalStatusRecord = Database['animal_statuses']
export type AnimalRecord = Database['animals']
export type TreatmentRecord = Database['treatments']
export type LedgerCategoryRecord = Database['ledger_categories']
export type LedgerEntryRecord = Database['ledger_entries']
export type PhotoRecord = Database['photos']
