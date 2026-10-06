import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@powersync/react'
import {
  ArrowLeft,
  Camera,
  CheckCircle,
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
  setSingleStatusAssignment,
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
import { StatusSingleSelect } from '@/features/animals/components/StatusSingleSelect'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { MedicalCrossIcon } from '@/shared/ui/MedicalCrossIcon'
import { CreateStatusModal } from '@/features/statuses/components/CreateStatusModal'
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
  const [statusId, setStatusId] = useState<string | null>(null)
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
  const [showAddStatusModal, setShowAddStatusModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusEffectiveAt, setStatusEffectiveAt] = useState(() =>
    toDatetimeLocalValue(new Date().toISOString()),
  )
  const [statusNotes, setStatusNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'care' | 'timeline'>('care')

  async function reload() {
    if (!db || !id) return
    const [nextAnimal, nextTreatments, assignments] = await Promise.all([
      getAnimal(db, id),
      listTreatmentsForAnimal(db, id),
      listAssignmentsForAnimal(db, id),
    ])
    setAnimal(nextAnimal)
    setTreatments(nextTreatments)
    setStatusId(assignments[0]?.status_id ?? nextAnimal?.status_id ?? null)
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

  function openStatusModal() {
    setStatusEffectiveAt(toDatetimeLocalValue(new Date().toISOString()))
    setStatusNotes('')
    setShowStatusModal(true)
  }

  function closeStatusModal() {
    setShowStatusModal(false)
    setStatusNotes('')
    setStatusId(animal?.status_id ?? null)
  }

  async function onSaveStatusForm(e: FormEvent) {
    e.preventDefault()
    if (!db || !id || !member || !statusId) return
    setError(null)
    try {
      const effectiveIso = new Date(statusEffectiveAt).toISOString()
      const trimmedNotes = statusNotes.trim()
      await setSingleStatusAssignment(db, {
        orgId: member.orgId,
        animalId: id,
        statusId,
        treatedAt: statusEffectiveAt,
        notes: trimmedNotes,
      })
      const selectedStatus = statuses.find((s) => s.id === statusId)
      const label = selectedStatus?.label || 'Status update'
      await addTreatment(db, {
        orgId: member.orgId,
        animalId: id,
        treatmentType: 'status',
        notes: trimmedNotes ? `${label} - ${trimmedNotes}` : label,
        treatedAt: effectiveIso,
      })
      setShowStatusModal(false)
      setStatusNotes('')
      setToast('Status updated')
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update status. Try again.',
      )
    }
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

  const careTreatments = treatments.filter(
    (t) => t.treatment_type !== 'status' && !isArrivalTreatmentType(t.treatment_type),
  )
  const timelineTreatments = treatments.filter(
    (t) => t.treatment_type === 'status',
  )
  const arrivalTreatments = treatments.filter(
    (t) => isArrivalTreatmentType(t.treatment_type),
  )

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
                          ? 'Upload failed. Keep this phone online with the app open to retry.'
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
              <div className="detail-hero__title-wrap">
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
                  className="btn--icon btn--inline-edit"
                  aria-label="Edit animal"
                  title="Edit"
                >
                  <PencilSimple size={18} weight="bold" aria-hidden />
                </Button>
              </div>

              {member ? (
                <button
                  type="button"
                  className={`animal-daily-care-btn${onChecklist ? ' is-active' : ''}`}
                  disabled={checklistBusy}
                  onClick={() => void onToggleChecklist()}
                  aria-label={onChecklist ? 'Remove from Daily Care' : 'Add to Daily Care'}
                >
                  {onChecklist ? (
                    <>
                      <CheckCircle size={16} weight="fill" /> In Daily Care
                    </>
                  ) : (
                    <>
                      <MedicalCrossIcon size={14} /> Daily Care
                    </>
                  )}
                </button>
              ) : null}
            </div>
            {animal.name?.trim() ? (
              <p className="detail-hero__title shelter-code">
                {animal.shelter_code}
              </p>
            ) : null}
          </div>

          {animal.species === 'Unknown' ? (
            <div className="stub-callout">
              <div className="stub-callout__header">
                <strong className="stub-callout__title">Rescue details needed</strong>
                <Link to={`/animals/${animal.id}/edit`} className="stub-callout__btn">
                  Add
                </Link>
              </div>
              <p className="stub-callout__body">
                This animal was saved during quick field intake.
              </p>
            </div>
          ) : detailMeta ? (
            <p className="muted" style={{ margin: 0 }}>
              {detailMeta}
            </p>
          ) : null}

        </div>
      </div>

      <div
        className="tab-group"
        role="tablist"
        style={{ marginTop: '1.5rem', marginBottom: '1rem' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'care'}
          className={`tab-btn${activeTab === 'care' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('care')}
        >
          Care History
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeline'}
          className={`tab-btn${activeTab === 'timeline' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'care' ? (
        <div className="tab-panel" role="tabpanel">
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 style={{ margin: 0 }}>Care History</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={openCreateCareForm}
            >
              Log care
            </Button>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            {careTreatments.map((t) => {
              const type = t.treatment_type as TreatmentType
              const title = TREATMENT_LABELS[type] ?? t.treatment_type
              return (
                <div className="list-item list-item--row" key={t.id}>
                  <div
                    className="list-item__body"
                    style={{
                      border: 'none',
                      padding: 0,
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span className="timeline-dot" aria-hidden />
                    <div>
                      <strong>{title}</strong>{' '}
                      <span className="muted">
                        {t.treated_at
                          ? formatCareTimestamp(t.treated_at)
                          : 'Unknown date'}
                      </span>
                      {t.notes?.trim() ? (
                        <div className="list-item__notes">{t.notes}</div>
                      ) : null}
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
              )
            })}
            {careTreatments.length === 0 ? (
              <p className="muted">
                No care notes yet. Tap Log care to add the first one.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="tab-panel" role="tabpanel">
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Status timeline</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={openStatusModal}
            >
              Update status
            </Button>
          </div>

          <div className="timeline-feed" style={{ marginTop: '0.5rem' }}>
            {timelineTreatments.map((t) => {
              const trimmedNotes = t.notes?.trim()
              let badgeLabel = animal.status_label || 'Status update'
              let displayNotes: string | null = null

              if (trimmedNotes) {
                if (trimmedNotes.includes(' - ')) {
                  const [prefix, ...rest] = trimmedNotes.split(' - ')
                  badgeLabel = prefix.trim()
                  displayNotes = rest.join(' - ').trim() || null
                } else if (
                  statuses.some(
                    (s) => s.label?.toLowerCase() === trimmedNotes.toLowerCase(),
                  ) ||
                  trimmedNotes.toLowerCase() ===
                    animal.status_label?.toLowerCase() ||
                  animal.status_labels?.some(
                    (l) => l?.toLowerCase() === trimmedNotes.toLowerCase(),
                  )
                ) {
                  badgeLabel = trimmedNotes
                  displayNotes = null
                } else {
                  badgeLabel = animal.status_label || 'Status update'
                  displayNotes = trimmedNotes
                }
              }

              return (
                <div className="timeline-entry" key={t.id}>
                  <div className="timeline-track">
                    <span className="timeline-dot" />
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-item__primary">
                      <StatusBadge label={badgeLabel} />
                    </div>
                    <div className="timeline-item__timestamp muted">
                      {t.treated_at
                        ? formatCareTimestamp(t.treated_at)
                        : 'Unknown date'}
                    </div>
                    {displayNotes ? (
                      <div className="timeline-item__notes">{displayNotes}</div>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {arrivalTreatments.map((t) => {
              const type = t.treatment_type as TreatmentType
              const label = TREATMENT_LABELS[type] ?? 'Arrived'
              return (
                <div className="timeline-entry" key={t.id}>
                  <div className="timeline-track">
                    <span className="timeline-dot timeline-dot--arrival" />
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-item__primary">
                      <StatusBadge label={label} tone="forest" />
                    </div>
                    <div className="timeline-item__timestamp muted">
                      {t.treated_at
                        ? formatCareTimestamp(t.treated_at)
                        : 'Unknown date'}
                    </div>
                    {t.notes?.trim() ? (
                      <div className="timeline-item__notes">{t.notes}</div>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {showLegacyArrival ? (
              <div className="timeline-entry">
                <div className="timeline-track">
                  <span className="timeline-dot timeline-dot--arrival" />
                </div>
                <div className="timeline-item">
                  <div className="timeline-item__primary">
                    <StatusBadge label="Arrived" tone="forest" />
                  </div>
                  <div className="timeline-item__timestamp muted">
                    {animal.intake_date
                      ? formatCareTimestamp(`${animal.intake_date}T12:00:00`)
                      : 'Arrival'}
                  </div>
                  {animal.notes?.trim() ? (
                    <div className="timeline-item__notes">{animal.notes}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {timelineTreatments.length === 0 &&
            arrivalTreatments.length === 0 &&
            !showLegacyArrival ? (
              <p className="muted">No status transitions recorded yet.</p>
            ) : null}
          </div>
        </div>
      )}

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

      <ResponsiveSheetModal
        isOpen={showCareForm}
        onClose={resetCareForm}
        title={editingTreatmentId ? 'Edit care note' : 'Log care'}
      >
        <form className="stack" onSubmit={onSaveTreatment}>
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
          <div className="responsive-modal__actions">
            <Button type="submit" variant="primary" disabled={!notes.trim()}>
              {editingTreatmentId ? 'Save changes' : 'Save care note'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCareForm}>
              Cancel
            </Button>
          </div>
        </form>
      </ResponsiveSheetModal>

      <ResponsiveSheetModal
        isOpen={showStatusModal}
        onClose={closeStatusModal}
        title="Update status"
      >
        <form className="stack" onSubmit={onSaveStatusForm}>
          <p className="section-label" style={{ margin: 0 }}>
            Select new status
          </p>
          <StatusSingleSelect
            statuses={statuses}
            value={statusId}
            onChange={(nextId) => setStatusId(nextId)}
            onAddStatus={() => setShowAddStatusModal(true)}
          />
          <TextField
            label="Effective date & time"
            type="datetime-local"
            value={statusEffectiveAt}
            onChange={(e) => setStatusEffectiveAt(e.target.value)}
          />
          <TextareaField
            label="Notes"
            hint="optional — reason for status change"
            rows={2}
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            placeholder="e.g. Cleared quarantine, moved to foster..."
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="responsive-modal__actions">
            <Button type="submit" variant="primary">
              Save status
            </Button>
            <Button type="button" variant="ghost" onClick={closeStatusModal}>
              Cancel
            </Button>
          </div>
        </form>
      </ResponsiveSheetModal>
    </section>
  )
}
