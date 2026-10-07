import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@powersync/react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  PencilSimple,
  Trash,
  X,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  getAnimal,
  updateAnimal,
  type AnimalWithStatus,
  type AnimalLifeStage,
} from '@/features/animals/domain/animals'
import {
  getAnimalRelationships,
  linkAnimals,
  unlinkAnimals,
  type AnimalRelationship,
  type RelationshipType,
} from '@/features/animals/domain/relationships'
import { splitSpecies } from '@/features/animals/screens/AnimalIntakeScreen'
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
import { AnimalLineArt } from '@/features/animals/components/AnimalLineArt'
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

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  bonded: 'Bonded',
  mother: 'Mother',
  child: 'Child',
  sibling: 'Sibling',
  incompatible: 'Incompatible',
}

const RELATIONSHIP_TONES: Record<RelationshipType, 'forest' | 'amber' | 'danger'> = {
  bonded: 'forest',
  mother: 'amber',
  child: 'amber',
  sibling: 'amber',
  incompatible: 'danger',
}

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'bonded', label: 'Bonded' },
  { value: 'mother', label: 'Mother' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'incompatible', label: 'Incompatible' },
]

const TREATMENT_LABELS: Record<TreatmentType, string> = {
  meds: 'Medicine',
  vet: 'Vet visit',
  procedure: 'Procedure',
  other: 'Other care',
  intake: 'Arrived',
  arrived: 'Arrived',
  status: 'Status',
}

type AnimalDetailTab = 'care' | 'timeline' | 'details'

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
  const [selectedTab, setSelectedTab] = useState<AnimalDetailTab | null>(null)

  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false)
  const [editSpeciesPreset, setEditSpeciesPreset] = useState('Dog')
  const [editSpeciesOther, setEditSpeciesOther] = useState('')
  const [editLifeStage, setEditLifeStage] = useState<AnimalLifeStage>('adult')
  const [editSex, setEditSex] = useState('')
  const [editMarkings, setEditMarkings] = useState('')
  const [editDetailsBusy, setEditDetailsBusy] = useState(false)

  const [relationships, setRelationships] = useState<AnimalRelationship[]>([])
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [selectedRelatedAnimalId, setSelectedRelatedAnimalId] = useState<string | null>(null)
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<RelationshipType>('bonded')
  const [linkNotes, setLinkNotes] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [availableAnimals, setAvailableAnimals] = useState<
    {
      id: string
      name: string | null
      shelter_code: string
      species: string
      life_stage: 'adult' | 'child'
    }[]
  >([])

  useEffect(() => {
    setSelectedTab(null)
  }, [id])

  function openEditDetailsModal() {
    if (!animal) return
    const { preset, other } = splitSpecies(animal.species)
    setEditSpeciesPreset(preset)
    setEditSpeciesOther(other)
    setEditLifeStage(animal.life_stage ?? 'adult')
    setEditSex(animal.sex ?? '')
    setEditMarkings(animal.markings ?? '')
    setError(null)
    setShowEditDetailsModal(true)
  }

  function closeEditDetailsModal() {
    setShowEditDetailsModal(false)
    setError(null)
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!db || !id) return
    const finalSpecies =
      editSpeciesPreset === 'Other' ? editSpeciesOther.trim() : editSpeciesPreset
    if (!finalSpecies) {
      setError('Please choose or enter an animal species.')
      return
    }

    setEditDetailsBusy(true)
    setError(null)
    try {
      await updateAnimal(db, id, {
        species: finalSpecies,
        life_stage: editLifeStage,
        sex: editSex.trim() || undefined,
        markings: editMarkings.trim() || undefined,
      })
      setToast('Animal details updated.')
      setShowEditDetailsModal(false)
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update animal details.',
      )
    } finally {
      setEditDetailsBusy(false)
    }
  }

  async function reloadRelationships() {
    if (!db || !id) return
    try {
      const nextRelationships = await getAnimalRelationships(db, id)
      setRelationships(nextRelationships)
    } catch (err) {
      console.warn('Failed to reload relationships', err)
    }
  }

  async function openLinkAnimalModal() {
    setLinkSearchQuery('')
    setSelectedRelatedAnimalId(null)
    setSelectedRelationshipType('bonded')
    setLinkNotes('')
    setError(null)
    setShowLinkModal(true)
    if (db && member && id) {
      try {
        const rows = await db.getAll<{
          id: string
          name: string | null
          shelter_code: string
          species: string
          life_stage: 'adult' | 'child'
        }>(
          `SELECT id, name, shelter_code, species, life_stage
           FROM animals
           WHERE org_id = ? AND id != ? AND archived = 0
           ORDER BY shelter_code ASC`,
          [member.orgId, id],
        )
        setAvailableAnimals(rows)
      } catch (err) {
        console.warn('Failed to load animals for linking', err)
      }
    }
  }

  function closeLinkAnimalModal() {
    setShowLinkModal(false)
    setError(null)
  }

  async function onSaveLinkAnimal(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !id) return
    if (!selectedRelatedAnimalId) {
      setError('Please select an animal to link.')
      return
    }
    setLinkBusy(true)
    setError(null)
    try {
      await linkAnimals(db, {
        orgId: member.orgId,
        animalId: id,
        relatedAnimalId: selectedRelatedAnimalId,
        relationshipType: selectedRelationshipType,
        notes: linkNotes.trim() || null,
      })
      setToast('Animals linked')
      setShowLinkModal(false)
      await reloadRelationships()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not link animals. Try again.',
      )
    } finally {
      setLinkBusy(false)
    }
  }

  async function onUnlink(rel: AnimalRelationship) {
    if (!db || !id) return
    const targetName = rel.relatedAnimalName || rel.relatedShelterCode
    const ok = await confirm({
      title: 'Unlink animal?',
      body: `Remove the relationship between this animal and ${targetName}?`,
      confirmLabel: 'Unlink',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await unlinkAnimals(db, {
        animalId: id,
        relatedAnimalId: rel.relatedAnimalId,
      })
      setToast('Animal unlinked')
      await reloadRelationships()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not unlink animal. Try again.',
      )
    }
  }

  async function reload() {
    if (!db || !id) return
    const [nextAnimal, nextTreatments, assignments, nextRelationships] = await Promise.all([
      getAnimal(db, id),
      listTreatmentsForAnimal(db, id),
      listAssignmentsForAnimal(db, id),
      getAnimalRelationships(db, id).catch(() => []),
    ])
    setAnimal(nextAnimal)
    setTreatments(nextTreatments)
    setStatusId(assignments[0]?.status_id ?? nextAnimal?.status_id ?? null)
    setRelationships(nextRelationships)
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

  const hasCareNotes = careTreatments.length > 0
  const defaultTab: AnimalDetailTab = hasCareNotes ? 'care' : 'timeline'
  const activeTab: AnimalDetailTab = selectedTab ?? defaultTab

  const tabs: { id: AnimalDetailTab; label: string }[] = hasCareNotes
    ? [
        { id: 'care', label: 'Care' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'details', label: 'Details' },
      ]
    : [
        { id: 'timeline', label: 'Timeline' },
        { id: 'care', label: 'Care' },
        { id: 'details', label: 'Details' },
      ]

  const careFormTypes: TreatmentType[] =
    editingTreatmentId && SYSTEM_CARE_TYPES.includes(treatmentType)
      ? [treatmentType, ...CARE_FORM_TYPES]
      : CARE_FORM_TYPES
  const detailMeta = [animal.species, animal.sex, animal.markings]
    .filter(Boolean)
    .join(' · ')

  const filteredAnimals = availableAnimals.filter((a) => {
    if (a.id === id) return false
    const q = linkSearchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      a.shelter_code.toLowerCase().includes(q) ||
      Boolean(a.name && a.name.toLowerCase().includes(q))
    )
  })

  const selectedRelatedAnimal = availableAnimals.find(
    (a) => a.id === selectedRelatedAnimalId,
  )

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
              <AnimalLineArt
                species={animal.species}
                lifeStage={animal.life_stage || (animal as any).lifeStage}
                aspectRatio="cover"
                className="detail-hero__line-art"
              />
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
            <Link
              to={`/animals/${animal.id}/edit`}
              className="stub-callout stub-callout--clickable"
              aria-label="Rescue details needed. This animal was saved during quick field intake. Tap to add details."
            >
              <div className="stub-callout__header">
                <strong className="stub-callout__title">Rescue details needed</strong>
                <span className="stub-callout__btn">
                  Add <ArrowRight size={14} weight="bold" aria-hidden />
                </span>
              </div>
              <p className="stub-callout__body">
                This animal was saved during quick field intake.
              </p>
            </Link>
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setSelectedTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '0.75rem',
                        height: '1.5rem',
                        flexShrink: 0,
                      }}
                    >
                      <span className="timeline-dot" aria-hidden />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          minHeight: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        <strong>{title}</strong>{' '}
                        <span className="muted">
                          {t.treated_at
                            ? formatCareTimestamp(t.treated_at)
                            : 'Unknown date'}
                        </span>
                      </div>
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
      ) : null}

      {activeTab === 'timeline' ? (
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
      ) : null}

      {activeTab === 'details' ? (
        <div className="tab-panel" role="tabpanel">
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Animal Details</h2>
            {member ? (
              <Button
                type="button"
                variant="secondary"
                onClick={openEditDetailsModal}
              >
                Edit details
              </Button>
            ) : null}
          </div>
          <div className="tab-panel__content characteristics-card panel">
            <div className="characteristics-grid">
              <div className="characteristic-item">
                <span className="characteristic-label">Species & Life Stage</span>
                <span className="characteristic-value">
                  {animal.species} · {animal.life_stage === 'child' ? 'Child' : 'Adult'}
                </span>
              </div>
              <div className="characteristic-item">
                <span className="characteristic-label">Sex</span>
                <span className="characteristic-value">
                  {animal.sex?.trim() || 'Unknown'}
                </span>
              </div>
              <div className="characteristic-item characteristic-item--full">
                <span className="characteristic-label">Markings / Description</span>
                <span className="characteristic-value">
                  {animal.markings?.trim() || 'None recorded'}
                </span>
              </div>
              <div className="characteristic-item">
                <span className="characteristic-label">Shelter Code</span>
                <span className="characteristic-value shelter-code">
                  {animal.shelter_code}
                </span>
              </div>
              <div className="characteristic-item">
                <span className="characteristic-label">Intake Date</span>
                <span className="characteristic-value">
                  {animal.intake_date || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.5rem',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Relationships</h2>
            {member ? (
              <Button
                type="button"
                variant="secondary"
                onClick={openLinkAnimalModal}
              >
                + Link animal
              </Button>
            ) : null}
          </div>

          <div className="relationships-card panel">
            {relationships.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No linked animals yet. Record family members, bonded pairs, or incompatibility warnings.
              </p>
            ) : (
              <div className="relationships-list">
                {relationships.map((rel) => {
                  const label = RELATIONSHIP_LABELS[rel.relationshipType] ?? rel.relationshipType
                  const tone = RELATIONSHIP_TONES[rel.relationshipType] ?? 'default'
                  return (
                    <div className="list-item list-item--row relationship-item" key={rel.id}>
                      <div className="relationship-item__body">
                        <div className="relationship-item__avatar">
                          {rel.relatedPhotoUrl ? (
                            <img
                              src={rel.relatedPhotoUrl}
                              alt={rel.relatedAnimalName || rel.relatedShelterCode}
                              className="relationship-item__photo"
                            />
                          ) : (
                            <AnimalLineArt
                              species={rel.relatedSpecies}
                              lifeStage={rel.relatedLifeStage}
                              aspectRatio="square"
                              className="relationship-item__line-art"
                            />
                          )}
                        </div>
                        <div className="relationship-item__info">
                          <div className="relationship-item__headline">
                            <Link
                              to={`/animals/${rel.relatedAnimalId}`}
                              className="relationship-item__link"
                            >
                              {rel.relatedAnimalName ? (
                                <>
                                  <strong className="relationship-item__name">
                                    {rel.relatedAnimalName}
                                  </strong>{' '}
                                  <span className="relationship-item__code shelter-code muted">
                                    {rel.relatedShelterCode}
                                  </span>
                                </>
                              ) : (
                                <strong className="relationship-item__code shelter-code">
                                  {rel.relatedShelterCode}
                                </strong>
                              )}
                            </Link>
                            <StatusBadge label={label} tone={tone} />
                          </div>
                          {rel.notes?.trim() ? (
                            <div className="relationship-item__notes list-item__notes">
                              {rel.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {member ? (
                        <div className="list-item__actions">
                          <Button
                            type="button"
                            variant="danger-ghost"
                            className="btn--icon"
                            aria-label={`Unlink ${rel.relatedAnimalName || rel.relatedShelterCode}`}
                            title="Unlink animal"
                            onClick={() => void onUnlink(rel)}
                          >
                            <Trash size={18} weight="bold" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

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

      <ResponsiveSheetModal
        isOpen={showEditDetailsModal}
        onClose={closeEditDetailsModal}
        title="Edit details"
      >
        <form className="stack" onSubmit={onSaveDetails}>
          <div className="field">
            <span>Animal species</span>
            <div className="filter-chips" role="group" aria-label="Animal species">
              {SPECIES_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip"
                  aria-pressed={editSpeciesPreset === preset}
                  onClick={() => setEditSpeciesPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {editSpeciesPreset === 'Other' ? (
            <TextField
              label="Specify species"
              value={editSpeciesOther}
              onChange={(e) => setEditSpeciesOther(e.target.value)}
              required
              placeholder="e.g. Alpaca, Goat, Rabbit…"
            />
          ) : null}

          <div className="field">
            <span>Life stage</span>
            <div className="segmented" role="group" aria-label="Life stage">
              {(
                [
                  { value: 'adult', label: 'Adult' },
                  { value: 'child', label: 'Child' },
                ] as const
              ).map((stage) => (
                <button
                  key={stage.value}
                  type="button"
                  className="segmented__btn"
                  aria-pressed={editLifeStage === stage.value}
                  onClick={() => setEditLifeStage(stage.value)}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Sex</span>
            <div className="segmented" role="group" aria-label="Sex">
              {(['Female', 'Male', 'Unknown'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="segmented__btn"
                  aria-pressed={
                    editSex === option ||
                    (option === 'Unknown' && (!editSex || editSex === 'Unknown'))
                  }
                  onClick={() =>
                    setEditSex(option === 'Unknown' ? '' : option)
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <TextareaField
            label="Markings"
            hint="optional"
            rows={3}
            value={editMarkings}
            onChange={(e) => setEditMarkings(e.target.value)}
            placeholder="Colors, scars, collar tags, distinctive markings…"
          />

          {error ? <p className="form-error">{error}</p> : null}

          <div className="responsive-modal__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={editDetailsBusy}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditDetailsModal}
              disabled={editDetailsBusy}
            >
              Cancel
            </Button>
          </div>
        </form>
      </ResponsiveSheetModal>

      <ResponsiveSheetModal
        isOpen={showLinkModal}
        onClose={closeLinkAnimalModal}
        title="Link animal"
      >
        <form className="stack" onSubmit={onSaveLinkAnimal}>
          {selectedRelatedAnimal ? (
            <div className="field">
              <span>Animal to link</span>
              <div className="animal-pick animal-pick--selected">
                <span>
                  {selectedRelatedAnimal.name ? (
                    <strong>{selectedRelatedAnimal.name} · </strong>
                  ) : null}
                  <span className="shelter-code">
                    {selectedRelatedAnimal.shelter_code}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="btn--icon"
                  aria-label="Change animal"
                  onClick={() => setSelectedRelatedAnimalId(null)}
                >
                  <X size={16} weight="bold" aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <TextField
                label="Animal to link"
                placeholder="Search by ID or name"
                value={linkSearchQuery}
                onChange={(e) => setLinkSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {filteredAnimals.length > 0 ? (
                <ul
                  className="animal-suggest"
                  role="listbox"
                  aria-label="Matching animals"
                >
                  {filteredAnimals.slice(0, 10).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        role="option"
                        className="animal-suggest__item"
                        onClick={() => setSelectedRelatedAnimalId(a.id)}
                      >
                        {a.name ? `${a.name} · ` : ''}
                        <span className="shelter-code">{a.shelter_code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : linkSearchQuery.trim() ? (
                <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
                  No animals found matching "{linkSearchQuery}"
                </p>
              ) : null}
            </div>
          )}

          <div className="field">
            <span>Relationship type</span>
            <div
              className="filter-chips"
              role="group"
              aria-label="Relationship type"
            >
              {RELATIONSHIP_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className="chip"
                  aria-pressed={selectedRelationshipType === type.value}
                  onClick={() => setSelectedRelationshipType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <TextareaField
            label="Notes"
            hint="optional"
            rows={2}
            value={linkNotes}
            onChange={(e) => setLinkNotes(e.target.value)}
            placeholder="Notes about this relationship…"
          />

          {error ? <p className="form-error">{error}</p> : null}

          <div className="responsive-modal__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={linkBusy || !selectedRelatedAnimalId}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeLinkAnimalModal}
              disabled={linkBusy}
            >
              Cancel
            </Button>
          </div>
        </form>
      </ResponsiveSheetModal>
    </section>
  )
}
