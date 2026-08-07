import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import { createAnimal } from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { INTAKE_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { MoraleToast } from '@/shared/ui/MoraleToast'

export function AnimalIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [species, setSpecies] = useState('')
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
    let cancelled = false
    void listStatuses(db, member.orgId).then((rows) => {
      if (cancelled) return
      setStatuses(rows)
      if (rows[0]) setStatusId((current) => current || rows[0]!.id)
    })
    return () => {
      cancelled = true
    }
  }, [db, member])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member) return
    setBusy(true)
    setError(null)
    try {
      if (!species.trim() || !statusId) {
        throw new Error('Species and status are required')
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
      setError(err instanceof Error ? err.message : 'Could not save animal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen">
      <h1>New intake</h1>
      <p className="muted">Shelter ID is assigned automatically on save.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Species *
          <input value={species} onChange={(e) => setSpecies(e.target.value)} required />
        </label>
        <label>
          Status *
          <select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            required
          >
            {statuses.length === 0 ? (
              <option value="" disabled>
                No statuses yet — check Settings or wait for sync
              </option>
            ) : null}
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Sex
          <input value={sex} onChange={(e) => setSex(e.target.value)} />
        </label>
        <label>
          Markings
          <input value={markings} onChange={(e) => setMarkings(e.target.value)} />
        </label>
        <label>
          Intake date
          <input
            type="date"
            value={intakeDate}
            onChange={(e) => setIntakeDate(e.target.value)}
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
        <p className="muted">Photo can be added on the detail screen after save.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" type="submit" disabled={busy || !member}>
          {busy ? 'Saving…' : 'Save intake'}
        </button>
      </form>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
