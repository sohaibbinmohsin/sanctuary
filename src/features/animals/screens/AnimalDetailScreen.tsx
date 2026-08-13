import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@powersync/react'
import {
  ArrowLeft,
  Camera,
  ListChecks,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  getAnimal,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import {
  listAssignmentsForAnimal,
  replaceAnimalStatuses,
} from '@/features/statuses/domain/assignments'
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
import { VerifiedPhotoBadge } from '@/features/public/components/VerifiedPhotoBadge'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { pickMessage, TREATMENT_MESSAGES } from '@/shared/lib/morale/messages'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import {
  deletePhoto,
  getLocalPhoto,
} from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'
import { StatusMultiSelect } from '@/features/animals/components/StatusMultiSelect'
import {
  addAnimalsToChecklist,
  isAnimalOnChecklist,
  removeFromChecklist,
} from '@/features/checklist/domain/checklist'
import { formatCareTimestamp } from '@/shared/lib/dates'

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
  /** Null while waiting for R2 URL / local cache on this device. */
  url: string | null
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
  return null
}

export function AnimalDetailScreen() {
  const { id } = useParams()
  const location = useLocation()
  const backState = location.state as
    | { backTo?: string; backLabel?: string }
    | null
  const backTo = backState?.backTo || '/animals'
  const backLabel = backState?.backLabel || 'Animals'
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
  const [animal, setAnimal] = useState<AnimalWithStatus | null>(null)
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [statusIds, setStatusIds] = useState<string[]>([])
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const { data: photoRows = [] } = useQuery<PhotoRecord>(
    `SELECT * FROM photos WHERE animal_id = ? ORDER BY created_at DESC`,
    id ? [id] : [],
  )
  const [treatmentType, setTreatmentType] = useState<TreatmentType>('meds')
  const [notes, setNotes] = useState('')
  const [hideFromPublic, setHideFromPublic] = useState(false)
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
  const [onChecklist, setOnChecklist] = useState(false)
  const [checklistBusy, setChecklistBusy] = useState(false)

  async function reload() {
    if (!db || !id) return
    const [nextAnimal, nextTreatments, assignments] = await Promise.all([
      getAnimal(db, id),
      listTreatmentsForAnimal(db, id),
      listAssignmentsForAnimal(db, id),
    ])
    setAnimal(nextAnimal)
    setTreatments(nextTreatments)
    setStatusIds(assignments.map((assignment) => assignment.status_id))
    if (member) {
      setOnChecklist(await isAnimalOnChecklist(db, member.orgId, id))
    }
  }

  useEffect(() => {
    void reload()
  }, [db, id, member?.orgId])

  // Resolve display URLs whenever PowerSync brings new photo rows / r2 keys.
  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    void (async () => {
      const items: PhotoItem[] = []
      for (const photo of photoRows) {
        const url = await resolvePhotoUrl(photo)
        if (url?.startsWith('blob:')) objectUrls.push(url)
        items.push({ photo, url })
      }
      if (cancelled) {
        for (const u of objectUrls) URL.revokeObjectURL(u)
        return
      }
      setPhotos(items)
      setActivePhotoId((current) => {
        if (current && items.some((p) => p.photo.id === current)) return current
        return items[0]?.photo.id ?? null
      })
    })()
    return () => {
      cancelled = true
      for (const u of objectUrls) URL.revokeObjectURL(u)
    }
  }, [photoRows])

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
    setHideFromPublic(false)
    setError(null)
  }

  function openCreateCareForm() {
    setEditingTreatmentId(null)
    setTreatmentType('meds')
    setNotes('')
    setTreatedAt(toDatetimeLocalValue(new Date().toISOString()))
    setHideFromPublic(false)
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
    setHideFromPublic(Boolean(treatment.hide_from_public))
    setError(null)
    setShowCareForm(true)
  }

  async function onStatusChange(nextIds: string[]) {
    if (!db || !id || !member) return
    setStatusIds(nextIds)
    setError(null)
    try {
      await replaceAnimalStatuses(db, {
        orgId: member.orgId,
        animalId: id,
        statusIds: nextIds,
      })
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update status. Try again.',
      )
      await reload()
    }
  }

  async function onRequestExit(exitId: string) {
    const ok = await confirm({
      title: 'Mark as out of care?',
      body: 'All other statuses will be removed from this animal.',
      confirmLabel: 'Continue',
      tone: 'danger',
    })
    if (ok) await onStatusChange([exitId])
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

  async function onToggleChecklist() {
    if (!db || !member || !animal || checklistBusy) return
    setChecklistBusy(true)
    setError(null)
    try {
      if (onChecklist) {
        await removeFromChecklist(db, {
          orgId: member.orgId,
          animalId: animal.id,
        })
        setOnChecklist(false)
        setToast('Removed from checklist')
      } else {
        await addAnimalsToChecklist(db, {
          orgId: member.orgId,
          animalIds: [animal.id],
          addedBy: member.userId,
        })
        setOnChecklist(true)
        setToast('Added to checklist')
      }
    } catch (err) {
      console.warn('Checklist toggle failed', err)
      setError(
        err instanceof Error
          ? err.message
          : onChecklist
            ? 'Could not remove from checklist. Try again.'
            : 'Could not add to checklist. Try again.',
      )
    } finally {
      setChecklistBusy(false)
    }
  }

  async function onSaveTreatment(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !id) return
    if (!notes.trim()) {
      setError('Add a note before saving.')
      return
    }
    setError(null)
    try {
      if (editingTreatmentId) {
        await updateTreatment(db, editingTreatmentId, {
          treatmentType,
          notes: notes.trim(),
          treatedAt: new Date(treatedAt).toISOString(),
          hideFromPublic,
        })
        setToast('Care note updated')
      } else {
        await addTreatment(db, {
          orgId: member.orgId,
          animalId: id,
          treatmentType,
          notes: notes.trim(),
          treatedAt: new Date(treatedAt).toISOString(),
          hideFromPublic,
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
  const detailMeta = [animal.species, animal.sex, animal.markings]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="screen">
      <Link className="back-link" to={backTo}>
        <ArrowLeft size={18} weight="bold" aria-hidden />
        {backLabel}
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
                {activePhoto.url ? (
                  <img
                    src={activePhoto.url}
                    alt={animal.name ?? animal.shelter_code ?? 'Animal'}
                  />
                ) : (
                  <span className="detail-hero__photo-empty">
                    <AnimalLoader
                      label={
                        activePhoto.photo.upload_state === 'failed'
                          ? 'Upload failed. Keep the phone that took this photo online…'
                          : 'Photo uploading…'
                      }
                      fill={false}
                    />
                  </span>
                )}
                <VerifiedPhotoBadge
                  verified={Boolean(activePhoto.photo.verified)}
                  pending={
                    !activePhoto.photo.verified &&
                    activePhoto.photo.capture_source === 'camera' &&
                    (activePhoto.photo.upload_state === 'pending' ||
                      activePhoto.photo.upload_state === 'uploading' ||
                      activePhoto.photo.upload_state === 'failed')
                  }
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
                    aria-busy={!item.url || undefined}
                    style={
                      item.url
                        ? { backgroundImage: `url(${item.url})` }
                        : undefined
                    }
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
                  aria-busy={!item.url || undefined}
                  style={
                    item.url
                      ? { backgroundImage: `url(${item.url})` }
                      : undefined
                  }
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
            {animal.name?.trim() ? (
              <p className="detail-hero__title shelter-code">
                {animal.shelter_code}
              </p>
            ) : null}
          </div>

          {detailMeta ? (
            <p className="muted" style={{ margin: 0 }}>
              {detailMeta}
            </p>
          ) : null}

          <StatusMultiSelect
            statuses={statuses}
            value={statusIds}
            onChange={(nextIds) => void onStatusChange(nextIds)}
            onRequestExit={(exitId) => void onRequestExit(exitId)}
          />

          {member ? (
            <div className="animal-checklist-actions">
              <p className="animal-checklist-actions__heading">Checklist</p>
              <div className="animal-checklist-actions__row">
                {onChecklist ? (
                  <Button
                    type="button"
                    variant="danger-outline"
                    disabled={checklistBusy}
                    onClick={() => void onToggleChecklist()}
                  >
                    <Trash size={18} weight="bold" aria-hidden />
                    {checklistBusy ? 'Removing…' : 'Remove from checklist'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="accent"
                    disabled={checklistBusy}
                    onClick={() => void onToggleChecklist()}
                  >
                    <ListChecks size={18} weight="bold" aria-hidden />
                    {checklistBusy ? 'Adding…' : 'Add to checklist'}
                  </Button>
                )}
                <Button
                  to="/checklist"
                  state={{
                    backTo: `/animals/${animal.id}`,
                    backLabel: animal.name?.trim() || animal.shelter_code || 'Animal',
                  }}
                  variant="secondary"
                >
                  View checklist
                </Button>
              </div>
            </div>
          ) : null}
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
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was done, medicine given, next steps…"
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={hideFromPublic}
              onChange={(e) => setHideFromPublic(e.target.checked)}
            />
            <span>Hide from public</span>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row">
            <Button type="submit" variant="primary" disabled={!notes.trim()}>
              {editingTreatmentId ? 'Save changes' : 'Save care note'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCareForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div style={{ marginTop: '0.5rem' }}>
        {treatments.map((t) => {
          const type = t.treatment_type as TreatmentType
          const isStatus = type === 'status'
          const title = isStatus
            ? t.notes?.trim() || TREATMENT_LABELS.status
            : TREATMENT_LABELS[type] ?? t.treatment_type
          return (
          <div className="list-item list-item--row" key={t.id}>
            <div className="list-item__body timeline-item" style={{ border: 'none', padding: 0 }}>
              <span className="timeline-dot" aria-hidden />
              <div>
                {isStatus ? (
                  <>
                    <div>
                      <strong>Status</strong>
                    </div>
                    <div>{title}</div>
                    <span className="muted">
                      {t.treated_at
                        ? formatCareTimestamp(t.treated_at)
                        : 'Unknown date'}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{title}</strong>{' '}
                    <span className="muted">
                      {t.treated_at
                        ? formatCareTimestamp(t.treated_at)
                        : 'Unknown date'}
                    </span>
                    {t.notes?.trim() ? (
                      <div className="list-item__notes">{t.notes}</div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            {type === 'status' ? null : (
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
                {isArrivalTreatmentType(type) ? null : (
                  <Button
                    type="button"
                    variant="danger-ghost"
                    className="btn--icon"
                    aria-label="Delete care note"
                    onClick={() => void onDeleteTreatment(t.id)}
                  >
                    <Trash size={18} weight="bold" aria-hidden />
                  </Button>
                )}
              </div>
            )}
          </div>
          )
        })}
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
                    ? formatCareTimestamp(`${animal.intake_date}T12:00:00`)
                    : 'Arrival'}
                </span>
                {animal.notes?.trim() ? (
                  <div className="list-item__notes">{animal.notes}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {treatments.length === 0 && !showLegacyArrival ? (
          <p className="muted">No care notes yet. Tap Log care to add the first one.</p>
        ) : null}
      </div>

      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
