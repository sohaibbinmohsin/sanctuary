import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, PencilSimple, Trash } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  getAnimal,
  archiveAnimal,
  updateAnimalStatus,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import {
  addTreatment,
  deleteTreatment,
  isArrivalTreatmentType,
  listTreatmentsForAnimal,
  updateTreatment,
  type TreatmentType,
} from '@/features/treatments/domain/treatments'
import type { PhotoRecord, TreatmentRecord } from '@/features/sync/powersync/schema'
import { PhotoCapture } from '@/features/animals/components/PhotoCapture'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { pickMessage, TREATMENT_MESSAGES } from '@/shared/lib/morale/messages'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import {
  deletePhoto,
  deletePhotosForAnimal,
  getLocalPhoto,
  listPhotosForAnimal,
  localPhotoUrl,
} from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'

const TREATMENT_LABELS: Record<TreatmentType, string> = {
  meds: 'Medicine',
  vet: 'Vet visit',
  procedure: 'Procedure',
  other: 'Other care',
  intake: 'Arrived',
  arrived: 'Arrived',
  status: 'Status',
}

const CARE_FORM_TYPES: TreatmentType[] = ['meds', 'vet', 'procedure', 'other']
const SYSTEM_CARE_TYPES: TreatmentType[] = ['arrived', 'intake', 'status']

type PhotoItem = {
  photo: PhotoRecord
  url: string
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 16)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function resolvePhotoUrl(photo: PhotoRecord): Promise<string | null> {
  const remote = publicPhotoUrl(photo.r2_key)
  if (remote) return remote
  const local = await getLocalPhoto(photo.id)
  if (local) return URL.createObjectURL(local)
  return localPhotoUrl(photo.id)
}

export function AnimalDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
  const [animal, setAnimal] = useState<AnimalWithStatus | null>(null)
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [treatmentType, setTreatmentType] = useState<TreatmentType>('meds')
  const [notes, setNotes] = useState('')
  const [treatedAt, setTreatedAt] = useState(
    () => toDatetimeLocalValue(new Date().toISOString()),
  )
  const [showCareForm, setShowCareForm] = useState(false)
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(
    null,
  )
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [removingAnimal, setRemovingAnimal] = useState(false)

  async function reload() {
    if (!db || !id) return
    setAnimal(await getAnimal(db, id))
    setTreatments(await listTreatmentsForAnimal(db, id))
    const rows = await listPhotosForAnimal(db, id)
    const items: PhotoItem[] = []
    for (const photo of rows) {
      const url = await resolvePhotoUrl(photo)
      if (url) items.push({ photo, url })
    }
    setPhotos(items)
    setActivePhotoId((current) => {
      if (current && items.some((p) => p.photo.id === current)) return current
      return items[0]?.photo.id ?? null
    })
  }

  useEffect(() => {
    void reload()
  }, [db, id])

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then(setStatuses)
  }, [db, member])

  function resetCareForm() {
    setShowCareForm(false)
    setEditingTreatmentId(null)
    setTreatmentType('meds')
    setNotes('')
    setTreatedAt(toDatetimeLocalValue(new Date().toISOString()))
    setError(null)
  }

  function openCreateCareForm() {
    setEditingTreatmentId(null)
    setTreatmentType('meds')
    setNotes('')
    setTreatedAt(toDatetimeLocalValue(new Date().toISOString()))
    setError(null)
    setShowCareForm(true)
  }

  function openEditCareForm(treatment: TreatmentRecord) {
    const type = (treatment.treatment_type as TreatmentType) || 'other'
    setEditingTreatmentId(treatment.id)
    setTreatmentType(
      CARE_FORM_TYPES.includes(type) || SYSTEM_CARE_TYPES.includes(type)
        ? type
        : 'other',
    )
    setNotes(treatment.notes ?? '')
    setTreatedAt(toDatetimeLocalValue(treatment.treated_at))
    setError(null)
    setShowCareForm(true)
  }

  async function onStatusChange(statusId: string) {
    if (!db || !id) return
    await updateAnimalStatus(db, id, statusId)
    await reload()
  }

  async function onDeletePhoto(photoId: string) {
    if (!db) return
    const ok = await confirm({
      title: 'Delete this photo?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete photo',
      tone: 'danger',
    })
    if (!ok) return
    setDeletingPhoto(true)
    try {
      await deletePhoto(db, photoId)
      setToast('Photo deleted')
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete photo. Try again.',
      )
    } finally {
      setDeletingPhoto(false)
    }
  }

  async function onDeleteTreatment(treatmentId: string) {
    if (!db) return
    const ok = await confirm({
      title: 'Delete this care note?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete note',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteTreatment(db, treatmentId)
      if (editingTreatmentId === treatmentId) resetCareForm()
      setToast('Care note deleted')
      await reload()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete care note. Try again.',
      )
    }
  }

  async function onRemoveAnimal() {
    if (!db || !animal) return
    const label = animal.shelter_code || animal.name || 'this animal'
    const ok = await confirm({
      title: `Remove ${label}?`,
      body: 'They will leave your Animals list. Use this if the record was added by mistake.',
      confirmLabel: 'Remove animal',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingAnimal(true)
    try {
      await deletePhotosForAnimal(db, animal.id)
      await archiveAnimal(db, animal.id)
      navigate('/animals', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove animal. Try again.',
      )
      setRemovingAnimal(false)
    }
  }

  async function onSaveTreatment(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !id) return
    setError(null)
    try {
      if (editingTreatmentId) {
        await updateTreatment(db, editingTreatmentId, {
          treatmentType,
          notes,
          treatedAt: new Date(treatedAt).toISOString(),
        })
        setToast('Care note updated')
      } else {
        await addTreatment(db, {
          orgId: member.orgId,
          animalId: id,
          treatmentType,
          notes,
          treatedAt: new Date(treatedAt).toISOString(),
        })
        setToast(pickMessage(TREATMENT_MESSAGES))
      }
      resetCareForm()
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save care note. Try again.',
      )
    }
  }

  const activePhoto =
    photos.find((p) => p.photo.id === activePhotoId) ?? photos[0] ?? null

  if (!animal) {
    return (
      <section className="screen">
        <AnimalLoader label="Loading animal…" />
      </section>
    )
  }

  const hasArrivalEntry = treatments.some((t) =>
    isArrivalTreatmentType(t.treatment_type),
  )
  const showLegacyArrival = Boolean(animal.intake_date && !hasArrivalEntry)

  const careFormTypes: TreatmentType[] =
    editingTreatmentId && SYSTEM_CARE_TYPES.includes(treatmentType)
      ? [treatmentType, ...CARE_FORM_TYPES]
      : CARE_FORM_TYPES

  return (
    <section className="screen">
      <Link className="back-link" to="/animals">
        <ArrowLeft size={18} weight="bold" aria-hidden />
        Animals
      </Link>

      <div className="detail-hero">
        <div className="stack">
          <div
            className={
              activePhoto
                ? 'detail-hero__photo'
                : 'detail-hero__photo detail-hero__photo--empty'
            }
          >
            {activePhoto ? (
              <>
                <img
                  src={activePhoto.url}
                  alt={animal.name ?? animal.shelter_code ?? 'Animal'}
                />
                <button
                  type="button"
                  className="detail-hero__photo-delete"
                  disabled={deletingPhoto}
                  aria-label={deletingPhoto ? 'Deleting photo' : 'Delete photo'}
                  title="Delete photo"
                  onClick={() => void onDeletePhoto(activePhoto.photo.id)}
                >
                  <Trash size={16} weight="bold" aria-hidden />
                </button>
              </>
            ) : (
              <span className="detail-hero__photo-empty">
                <Camera size={28} weight="duotone" aria-hidden />
                No photo yet
              </span>
            )}
          </div>

          {member ? (
            <>
              <div className="photo-strip" role="list" aria-label="Photos">
                <PhotoCapture
                  orgId={member.orgId}
                  animalId={animal.id}
                  onQueued={() => void reload()}
                  onError={setError}
                />
                {photos.map((item) => (
                  <button
                    key={item.photo.id}
                    type="button"
                    role="listitem"
                    className={
                      item.photo.id === activePhoto?.photo.id
                        ? 'photo-strip__thumb photo-strip__thumb--active'
                        : 'photo-strip__thumb'
                    }
                    onClick={() => setActivePhotoId(item.photo.id)}
                    aria-label="Show this photo"
                    style={{ backgroundImage: `url(${item.url})` }}
                  />
                ))}
              </div>
              {error && !showCareForm ? (
                <p className="form-error">{error}</p>
              ) : null}
            </>
          ) : photos.length > 0 ? (
            <div className="photo-strip" role="list" aria-label="Photos">
              {photos.map((item) => (
                <button
                  key={item.photo.id}
                  type="button"
                  role="listitem"
                  className={
                    item.photo.id === activePhoto?.photo.id
                      ? 'photo-strip__thumb photo-strip__thumb--active'
                      : 'photo-strip__thumb'
                  }
                  onClick={() => setActivePhotoId(item.photo.id)}
                  aria-label="Show this photo"
                  style={{ backgroundImage: `url(${item.url})` }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="stack">
          <div>
            <div className="detail-hero__id-row">
              <h1
                className={
                  animal.name?.trim()
                    ? 'detail-hero__title'
                    : 'detail-hero__title shelter-code'
                }
              >
                {animal.name?.trim() || animal.shelter_code}
              </h1>
              <Button
                to={`/animals/${animal.id}/edit`}
                variant="ghost"
                className="btn--icon"
                aria-label="Edit animal"
                title="Edit"
              >
                <PencilSimple size={18} weight="bold" aria-hidden />
              </Button>
            </div>
            <p
              className={
                animal.name?.trim()
                  ? 'detail-hero__title shelter-code'
                  : 'detail-hero__title'
              }
            >
              {animal.name?.trim()
                ? animal.shelter_code
                : animal.species}
            </p>
            {animal.status_label ? (
              <div style={{ marginTop: '0.65rem' }}>
                <StatusBadge label={animal.status_label} />
              </div>
            ) : null}
          </div>

          <p className="muted" style={{ margin: 0 }}>
            {[animal.species, animal.sex, animal.markings]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <SelectField
            label="Status"
            value={animal.status_id ?? ''}
            options={statuses.map((s) => ({ value: s.id, label: s.label ?? '' }))}
            onChange={(value) => void onStatusChange(value)}
          />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Care log</h2>
        {!showCareForm ? (
          <Button
            type="button"
            variant="secondary"
            onClick={openCreateCareForm}
          >
            Log care
          </Button>
        ) : null}
      </div>

      {showCareForm ? (
        <form className="panel stack" onSubmit={onSaveTreatment} style={{ marginTop: '1rem' }}>
          <SelectField
            label="What kind of care?"
            value={treatmentType}
            options={careFormTypes.map((key) => ({
              value: key,
              label: TREATMENT_LABELS[key],
            }))}
            onChange={(value) => setTreatmentType(value as TreatmentType)}
          />
          <TextField
            label="When"
            type="datetime-local"
            value={treatedAt}
            onChange={(e) => setTreatedAt(e.target.value)}
          />
          <TextareaField
            label="Notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was done, medicine given, next steps…"
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row">
            <Button type="submit" variant="primary">
              {editingTreatmentId ? 'Save changes' : 'Save care note'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCareForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div style={{ marginTop: '0.5rem' }}>
        {treatments.map((t) => (
          <div className="list-item list-item--row" key={t.id}>
            <div className="list-item__body timeline-item" style={{ border: 'none', padding: 0 }}>
              <span className="timeline-dot" aria-hidden />
              <div>
                <strong>
                  {TREATMENT_LABELS[t.treatment_type as TreatmentType] ??
                    t.treatment_type}
                </strong>{' '}
                <span className="muted">
                  {t.treated_at
                    ? new Date(t.treated_at).toLocaleString()
                    : 'Unknown date'}
                </span>
                {t.notes ? <div>{t.notes}</div> : null}
              </div>
            </div>
            <div className="list-item__actions">
              <Button
                type="button"
                variant="ghost"
                className="btn--icon"
                aria-label="Edit care note"
                title="Edit"
                onClick={() => openEditCareForm(t)}
              >
                <PencilSimple size={18} weight="bold" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="danger-ghost"
                className="btn--icon"
                aria-label="Delete care note"
                onClick={() => void onDeleteTreatment(t.id)}
              >
                <Trash size={18} weight="bold" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {showLegacyArrival ? (
          <div className="list-item list-item--row">
            <div
              className="list-item__body timeline-item"
              style={{ border: 'none', padding: 0 }}
            >
              <span className="timeline-dot" aria-hidden />
              <div>
                <strong>{TREATMENT_LABELS.arrived}</strong>{' '}
                <span className="muted">
                  {animal.intake_date
                    ? new Date(`${animal.intake_date}T12:00:00`).toLocaleString()
                    : 'Arrival'}
                </span>
                {animal.notes?.trim() ? <div>{animal.notes}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
        {treatments.length === 0 && !showLegacyArrival ? (
          <p className="muted">No care notes yet. Tap Log care to add the first one.</p>
        ) : null}
      </div>

      <div className="danger-zone">
        <p className="section-label">Remove animal</p>
        <p className="muted">
          Use this if this record was added by mistake. It will leave your Animals list.
        </p>
        <Button
          type="button"
          variant="danger-outline"
          disabled={removingAnimal}
          onClick={() => void onRemoveAnimal()}
        >
          <Trash size={18} weight="bold" aria-hidden />
          {removingAnimal ? 'Removing…' : 'Remove animal'}
        </Button>
      </div>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
