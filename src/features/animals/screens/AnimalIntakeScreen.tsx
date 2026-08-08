import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import { createAnimal } from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { INTAKE_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']

export function AnimalIntakeScreen() {
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
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then((rows) => {
      setStatuses(rows)
      if (rows[0]) setStatusId(rows[0].id)
    })
  }, [db, member])

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

  return (
    <section className="screen">
      <PageHeader
        title="Add an animal"
        subtitle="We'll create a shelter ID when you save."
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
            hint="optional"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything helpers should know"
          />
          <p className="muted">You can add photos on the next screen after saving.</p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={busy || !member}
          >
            {busy ? 'Saving…' : 'Save animal'}
          </Button>
        </div>
      </form>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
