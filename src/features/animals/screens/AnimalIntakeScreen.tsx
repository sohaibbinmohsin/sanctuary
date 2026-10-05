import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  createAnimal,
  getAnimal,
  updateAnimal,
  archiveAnimal,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { INTAKE_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextareaField, TextField } from '@/shared/ui/Field'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { StatusSingleSelect } from '@/features/animals/components/StatusSingleSelect'
import {
  deletePhotosForAnimal,
  processPhotoQueue,
  queuePhoto,
} from '@/features/photos/domain/photos'
import {
  IntakePhotoPicker,
  type StagedPhoto,
} from '@/features/animals/components/IntakePhotoPicker'
import { isPlaygroundMode } from '@/features/playground/mode'
import { CreateStatusModal } from '@/features/statuses/components/CreateStatusModal'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']

export function splitSpecies(species: string | null | undefined): {
  preset: string
  other: string
} {
  const value = species?.trim() ?? ''
  if (!value || value === 'Unknown') return { preset: 'Dog', other: '' }
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
  const confirm = useConfirm()
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [speciesPreset, setSpeciesPreset] = useState('Dog')
  const [speciesOther, setSpeciesOther] = useState('')
  const [statusId, setStatusId] = useState<string | null>(null)
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
  const [removing, setRemoving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const stagedPhotosRef = useRef<StagedPhoto[]>([])
  stagedPhotosRef.current = stagedPhotos

  useEffect(() => {
    return () => {
      for (const photo of stagedPhotosRef.current) {
        URL.revokeObjectURL(photo.previewUrl)
      }
    }
  }, [])
  const [showAddStatusModal, setShowAddStatusModal] = useState(false)

  useEffect(() => {
    if (!db || !member || isEdit) return
    void listStatuses(db, member.orgId).then((rows) => {
      setStatuses(rows)
      const firstInCare = rows.find((row) => row.counts_as_in_care === 1)
      if (firstInCare) {
        setStatusId((current) => current ?? firstInCare.id)
      }
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
        setName(animal.name ?? '')
        setSex(animal.sex ?? '')
        setMarkings(animal.markings ?? '')
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

  async function onRemoveAnimal() {
    if (!db || !animalId || removing) return
    const label = shelterCode || name.trim() || 'this animal'
    const ok = await confirm({
      title: `Remove ${label}?`,
      body: 'They will leave your Animals list. Use this if the record was added by mistake.',
      confirmLabel: 'Remove animal',
      tone: 'danger',
    })
    if (!ok) return
    setRemoving(true)
    setError(null)
    try {
      await deletePhotosForAnimal(db, animalId)
      await archiveAnimal(db, animalId)
      navigate('/animals', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove animal. Try again.',
      )
      setRemoving(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member) return
    setBusy(true)
    setError(null)
    try {
      if (!species) {
        throw new Error('Please choose an animal type.')
      }
      if (isEdit && animalId) {
        await updateAnimal(db, animalId, {
          species,
          name,
          sex,
          markings,
        })
        navigate(`/animals/${animalId}`, { replace: true })
        return
      }
      if (!statusId) {
        throw new Error('Please choose an animal type and status.')
      }
      const animal = await createAnimal(db, {
        orgId: member.orgId,
        prefix: member.orgInitials,
        species,
        statusIds: [statusId],
        name,
        sex,
        markings,
        notes,
        intakeDate,
      })

      for (const photo of stagedPhotos) {
        try {
          await queuePhoto(db, {
            orgId: member.orgId,
            animalId: animal.id,
            blob: photo.blob,
            captureSource: photo.captureSource,
          })
        } catch (photoErr) {
          console.warn('Failed to queue photo for new animal', photoErr)
        }
      }

      if (navigator.onLine && !isPlaygroundMode()) {
        void processPhotoQueue(db)
      }

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
    <section className="screen screen--sticky-footer">
      <PageHeader
        title={isEdit ? 'Edit animal' : 'Add an animal'}
        subtitle={
          isEdit
            ? shelterCode
              ? `Shelter ID ${shelterCode} stays the same.`
              : 'Update who they are.'
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

        {isEdit ? null : (
          <div className="panel stack">
            <div className="stack stack--tight">
              <p className="section-label">Photos</p>
              <span className="field__hint">Optional — take or choose photos</span>
            </div>
            <IntakePhotoPicker
              photos={stagedPhotos}
              onAddPhotos={(newPhotos) =>
                setStagedPhotos((current) => [...current, ...newPhotos])
              }
              onRemovePhoto={(photoId) => {
                setStagedPhotos((current) => {
                  const target = current.find((p) => p.id === photoId)
                  if (target) URL.revokeObjectURL(target.previewUrl)
                  return current.filter((p) => p.id !== photoId)
                })
              }}
              disabled={busy}
            />
          </div>
        )}

        {isEdit ? null : (
          <div className="panel stack">
            <p className="section-label">Arrival</p>
            <StatusSingleSelect
              statuses={statuses}
              value={statusId}
              onChange={setStatusId}
              onAddStatus={() => setShowAddStatusModal(true)}
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
          </div>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <div className={`sticky-actions${isEdit ? ' sticky-actions--split' : ''}`}>
          {isEdit ? (
            <Button
              type="button"
              variant="danger-outline"
              disabled={busy || removing}
              onClick={() => void onRemoveAnimal()}
            >
              <Trash size={18} weight="bold" aria-hidden />
              {removing ? 'Removing…' : 'Remove animal'}
            </Button>
          ) : null}
          <Button
            type="submit"
            variant="accent"
            block={!isEdit}
            disabled={busy || removing || !member}
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save animal'}
          </Button>
        </div>
      </form>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
      {showAddStatusModal && member ? (
        <CreateStatusModal
          orgId={member.orgId}
          onClose={() => setShowAddStatusModal(false)}
          onCreated={(newStatus) => {
            setStatuses((prev) => [...prev, newStatus])
            setStatusId(newStatus.id)
          }}
        />
      ) : null}
    </section>
  )
}
