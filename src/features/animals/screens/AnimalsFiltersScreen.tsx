import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import {
  parseAnimalFilterParams,
  serializeAnimalFilterParams,
} from '@/shared/lib/animals/filterParams'
import { Button } from '@/shared/ui/Button'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SelectField } from '@/shared/ui/SelectField'

const SPECIES_OPTIONS = [
  { value: '', label: 'Any type' },
  { value: 'Dog', label: 'Dog' },
  { value: 'Cat', label: 'Cat' },
  { value: 'Horse', label: 'Horse' },
  { value: 'Donkey', label: 'Donkey' },
  { value: 'Bird', label: 'Bird' },
  { value: 'Other', label: 'Other' },
]

const SEX_OPTIONS = [
  { value: '', label: 'Any gender' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: '__unknown__', label: 'Unknown' },
]

export function AnimalsFiltersScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() =>
    parseAnimalFilterParams(location.search),
  )
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])

  const returnTo =
    new URLSearchParams(location.search).get('return') === 'add-to-checklist'
      ? '/animals/add-to-checklist'
      : '/animals'
  const backLabel =
    returnTo === '/animals/add-to-checklist' ? 'Add to checklist' : 'Animals'

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then(setStatuses)
  }, [db, member])

  function toggleStatus(statusId: string) {
    setFilters((current) => ({
      ...current,
      statusIds: current.statusIds.includes(statusId)
        ? current.statusIds.filter((id) => id !== statusId)
        : [...current.statusIds, statusId],
    }))
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Keep list-page search (`q`); filters screen does not edit it.
    const query = parseAnimalFilterParams(location.search).query
    navigate(
      `${returnTo}${serializeAnimalFilterParams({ ...filters, query })}`,
    )
  }

  return (
    <section className="screen">
      <PageHeader
        title="Filter animals"
        subtitle="Choose which animals appear in the list"
        backTo={returnTo}
        backLabel={backLabel}
      />

      <form className="panel stack stack--loose" onSubmit={applyFilters}>
        <fieldset className="status-multi-select">
          <legend>Status</legend>
          <div
            className="status-multi-select__options"
            role="group"
            aria-label="Statuses"
          >
            {statuses.map((status) => {
              const selected = filters.statusIds.includes(status.id)
              return (
                <label
                  key={status.id}
                  className="status-multi-select__option"
                  data-selected={selected || undefined}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleStatus(status.id)}
                  />
                  <span>{status.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <p className="section-label">Status matching</p>
          <div
            className="segmented"
            role="group"
            aria-label="Status matching"
            style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '0.5rem' }}
          >
            <button
              type="button"
              className="segmented__btn"
              aria-pressed={filters.statusMode === 'any'}
              onClick={() =>
                setFilters((current) => ({ ...current, statusMode: 'any' }))
              }
            >
              Match any selected
            </button>
            <button
              type="button"
              className="segmented__btn"
              aria-pressed={filters.statusMode === 'all'}
              onClick={() =>
                setFilters((current) => ({ ...current, statusMode: 'all' }))
              }
            >
              Match all selected
            </button>
          </div>
        </div>

        <SelectField
          label="Type"
          value={filters.species}
          options={SPECIES_OPTIONS}
          onChange={(species) =>
            setFilters((current) => ({ ...current, species }))
          }
        />

        <SelectField
          label="Gender"
          value={filters.sex}
          options={SEX_OPTIONS}
          onChange={(sex) => setFilters((current) => ({ ...current, sex }))}
        />

        <div className="row">
          <Button type="submit" variant="accent">
            Apply
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(returnTo)}
          >
            Clear
          </Button>
        </div>
      </form>
    </section>
  )
}
