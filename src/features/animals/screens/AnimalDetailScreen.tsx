import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import {
  getAnimal,
  updateAnimalStatus,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import {
  addTreatment,
  listTreatmentsForAnimal,
  type TreatmentType,
} from '@/features/treatments/domain/treatments'
import type { TreatmentRecord } from '@/features/sync/powersync/schema'
import { PhotoCapture } from '@/features/animals/components/PhotoCapture'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { pickMessage, TREATMENT_MESSAGES } from '@/shared/lib/morale/messages'

export function AnimalDetailScreen() {
  const { id } = useParams()
  const db = useDb()
  const { member } = useCurrentMember()
  const [animal, setAnimal] = useState<AnimalWithStatus | null>(null)
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
  const [treatmentType, setTreatmentType] = useState<TreatmentType>('meds')
  const [notes, setNotes] = useState('')
  const [treatedAt, setTreatedAt] = useState(
    () => new Date().toISOString().slice(0, 16),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!db || !id) return
    setAnimal(await getAnimal(db, id))
    setTreatments(await listTreatmentsForAnimal(db, id))
  }

  useEffect(() => {
    void reload()
  }, [db, id])

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then(setStatuses)
  }, [db, member])

  async function onStatusChange(statusId: string) {
    if (!db || !id) return
    await updateAnimalStatus(db, id, statusId)
    await reload()
  }

  async function onAddTreatment(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !id) return
    setError(null)
    try {
      await addTreatment(db, {
        orgId: member.orgId,
        animalId: id,
        treatmentType,
        notes,
        treatedAt: new Date(treatedAt).toISOString(),
      })
      setNotes('')
      setToast(pickMessage(TREATMENT_MESSAGES))
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save treatment')
    }
  }

  if (!animal) {
    return (
      <section className="screen">
        <p className="muted">Loading animal…</p>
        <Link to="/animals">Back</Link>
      </section>
    )
  }

  return (
    <section className="screen">
      <Link to="/animals">← Animals</Link>
      <h1>{animal.shelter_code}</h1>
      <p>{animal.name || animal.species}</p>
      {animal.status_label ? <StatusBadge label={animal.status_label} /> : null}

      <div className="stack" style={{ marginTop: '1rem' }}>
        <p className="muted">
          {animal.species}
          {animal.sex ? ` · ${animal.sex}` : ''}
          {animal.markings ? ` · ${animal.markings}` : ''}
        </p>
        <p className="muted">Intake {animal.intake_date}</p>
        {animal.notes ? <p>{animal.notes}</p> : null}

        <label>
          Status
          <select
            value={animal.status_id ?? ''}
            onChange={(e) => void onStatusChange(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {member ? (
          <PhotoCapture orgId={member.orgId} animalId={animal.id} />
        ) : null}
      </div>

      <h2>Treatments</h2>
      <form className="stack" onSubmit={onAddTreatment}>
        <label>
          Type
          <select
            value={treatmentType}
            onChange={(e) => setTreatmentType(e.target.value as TreatmentType)}
          >
            <option value="meds">Meds</option>
            <option value="vet">Vet</option>
            <option value="procedure">Procedure</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          When
          <input
            type="datetime-local"
            value={treatedAt}
            onChange={(e) => setTreatedAt(e.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" type="submit">
          Add treatment
        </button>
      </form>

      <div>
        {treatments.map((t) => (
          <div className="list-item" key={t.id}>
            <strong>{t.treatment_type}</strong>{' '}
            <span className="muted">
              {t.treated_at
                ? new Date(t.treated_at).toLocaleString()
                : 'Unknown date'}
            </span>
            {t.notes ? <div>{t.notes}</div> : null}
          </div>
        ))}
        {treatments.length === 0 ? (
          <p className="muted">No treatments yet.</p>
        ) : null}
      </div>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
