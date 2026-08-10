import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import {
  createAnimal,
  getAnimal,
  updateAnimal,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { INTAKE_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']

function splitSpecies(species: string | null | undefined): {
  preset: string
  other: string
} {
  const value = species?.trim() ?? ''
  if (!value) return { preset: 'Dog', other: '' }
  if (SPECIES_PRESETS.includes(value) && value !== 'Other') {
    return { preset: value, other: '' }
  }
  return { preset: 'Other', other: value }
}

export function AnimalIntakeScreen() {
  const { id: animalId } = useParams<{ id: string }>()
  const isEdit = Boolean(animalId)
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [speciesPreset, setSpeciesPreset] = useState('Dog')
  const [speciesOther, setSpeciesOther] = useState('')
  const [statusId, setStatusId] = useState('')
  const [name, setName] = useState('')
  const [sex, setSex] = useState('')
  const [markings, setMarkings] = useState('')
  const [notes, setNotes] = useState('')
  const [intakeDate, setIntakeDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [shelterCode, setShelterCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then((rows) => {
      setStatuses(rows)
      if (!isEdit && rows[0]) setStatusId((current) => current || rows[0].id)
    })
  }, [db, member, isEdit])

  useEffect(() => {
    if (!db || !member || !isEdit || !animalId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const animal = await getAnimal(db, animalId)
        if (cancelled) return
        if (!animal || animal.org_id !== member.orgId || animal.archived) {
          setNotFound(true)
          return
        }
        const { preset, other } = splitSpecies(animal.species)
        setSpeciesPreset(preset)
        setSpeciesOther(other)
        setStatusId(animal.status_id ?? '')
        setName(animal.name ?? '')
        setSex(animal.sex ?? '')
        setMarkings(animal.markings ?? '')
        setNotes(animal.notes ?? '')
        setIntakeDate(
          animal.intake_date ?? new Date().toISOString().slice(0, 10),
        )
        setShelterCode(animal.shelter_code)
      } catch (err) {
        console.warn('Failed to load animal for edit', err)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member, isEdit, animalId])

  const species =
    speciesPreset === 'Other' ? speciesOther.trim() : speciesPreset

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member) return
    setBusy(true)
    setError(null)
    try {
      if (!species || !statusId) {
        throw new Error('Please choose an animal type and status.')
      }
      if (isEdit && animalId) {
        await updateAnimal(db, animalId, {
          species,
          statusId,
          name,
          sex,
          markings,
          notes,
          intakeDate,
        })
        navigate(`/animals/${animalId}`, { replace: true })
        return
      }
      const animal = await createAnimal(db, {
        orgId: member.orgId,
        prefix: member.orgInitials,
        species,
        statusId,
        name,
        sex,
        markings,
        notes,
        intakeDate,
      })
      setToast(pickMessage(INTAKE_MESSAGES))
      window.setTimeout(() => navigate(`/animals/${animal.id}`), 600)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="screen">
        <AnimalLoader label="Loading animal…" />
      </section>
    )
  }

  if (notFound) {
    return (
      <section className="screen">
        <PageHeader
          title="Animal not found"
          subtitle="It may have been removed."
          backTo="/animals"
          backLabel="Animals"
        />
      </section>
    )
  }

  return (
    <section className="screen">
      <PageHeader
        title={isEdit ? 'Edit animal' : 'Add an animal'}
        subtitle={
          isEdit
            ? shelterCode
              ? `Shelter ID ${shelterCode} stays the same.`
              : 'Update their details.'
            : "We'll create a shelter ID when you save."
        }
        backTo={isEdit && animalId ? `/animals/${animalId}` : '/animals'}
        backLabel={isEdit ? 'Animal' : 'Animals'}
      />

      <form className="stack stack--loose" onSubmit={onSubmit}>
        <div className="panel stack">
          <p className="section-label">Who are they?</p>
          <div className="field">
            <span>Animal type</span>
            <div className="filter-chips" role="group" aria-label="Animal type">
              {SPECIES_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip"
                  aria-pressed={speciesPreset === preset}
                  onClick={() => setSpeciesPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          {speciesPreset === 'Other' ? (
            <TextField
              label="Type"
              value={speciesOther}
              onChange={(e) => setSpeciesOther(e.target.value)}
              required
              placeholder="e.g. Goat"
            />
          ) : null}
          <TextField
            label="Name"
            hint="optional"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="If they have one"
          />
          <div className="field">
            <span>Sex</span>
            <div className="segmented" role="group" aria-label="Sex">
              {(['Female', 'Male', 'Unknown'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="segmented__btn"
                  aria-pressed={sex === option || (option === 'Unknown' && sex === '')}
                  onClick={() =>
                    setSex(option === 'Unknown' ? '' : option)
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="Markings"
            hint="optional"
            value={markings}
            onChange={(e) => setMarkings(e.target.value)}
            placeholder="Colors, scars, collar tags…"
          />
        </div>

        <div className="panel stack">
          <p className="section-label">Arrival</p>
          <SelectField
            label="Status"
            value={statusId}
            options={statuses.map((s) => ({
              value: s.id,
              label: s.label ?? '',
            }))}
            onChange={setStatusId}
            required
          />
          <TextField
            label="Date arrived"
            type="date"
            value={intakeDate}
            onChange={(e) => setIntakeDate(e.target.value)}
          />
          <TextareaField
            label="Notes"
            hint="optional — saved to the care log"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything helpers should know"
          />
          {isEdit ? null : (
            <p className="muted">You can add photos on the next screen after saving.</p>
          )}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={busy || !member}
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save animal'}
          </Button>
        </div>
      </form>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
