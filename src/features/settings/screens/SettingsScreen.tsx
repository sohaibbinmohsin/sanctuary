import { type FormEvent, useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  archiveStatus,
  createStatus,
  listStatuses,
  renameStatus,
  reorderStatuses,
  type AnimalStatus,
} from '@/features/statuses/domain/statuses'
import {
  archiveLedgerCategory,
  createLedgerCategory,
  listLedgerCategories,
  renameLedgerCategory,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import type { LedgerCategoryRecord } from '@/features/sync/powersync/schema'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { getSupportEmail } from '@/shared/lib/supabase'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { disconnectPowerSync } from '@/features/sync/powersync/database'
import { animalsToCsv, ledgerToCsv, treatmentsToCsv } from '@/shared/lib/export/csv'
import { buildExportZip } from '@/shared/lib/export/zipImages'
import {
  getLocalPhoto,
  listPhotosForAnimal,
} from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

export function SettingsScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const supportEmail = getSupportEmail()
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [categories, setCategories] = useState<LedgerCategoryRecord[]>([])
  const [newStatus, setNewStatus] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryDirection, setNewCategoryDirection] =
    useState<LedgerDirection>('out')
  const [exportBusy, setExportBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function reload() {
    if (!db || !member) return
    setStatuses(await listStatuses(db, member.orgId, true))
    setCategories(await listLedgerCategories(db, member.orgId, true))
  }

  useEffect(() => {
    void reload()
  }, [db, member])

  async function onAddStatus(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !newStatus.trim()) return
    await createStatus(db, { orgId: member.orgId, label: newStatus })
    setNewStatus('')
    await reload()
  }

  async function moveStatus(id: string, direction: -1 | 1) {
    if (!db) return
    const active = statuses.filter((s) => !s.archived)
    const idx = active.findIndex((s) => s.id === id)
    const swap = idx + direction
    if (idx < 0 || swap < 0 || swap >= active.length) return
    const ordered = active.map((s) => s.id)
    ;[ordered[idx], ordered[swap]] = [ordered[swap]!, ordered[idx]!]
    await reorderStatuses(db, ordered)
    await reload()
  }

  async function onAddCategory(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !newCategory.trim()) return
    await createLedgerCategory(db, {
      orgId: member.orgId,
      label: newCategory,
      direction: newCategoryDirection,
    })
    setNewCategory('')
    await reload()
  }

  async function exportData() {
    if (!db || !member) return
    setExportBusy(true)
    setMessage(null)
    try {
      const animals = await db.getAll<{
        id: string
        shelter_code: string
        name: string | null
        species: string
        sex: string | null
        markings: string | null
        intake_date: string
        notes: string | null
        status_label: string | null
      }>(
        `SELECT a.*, s.label as status_label
         FROM animals a
         LEFT JOIN animal_statuses s ON s.id = a.status_id
         WHERE a.org_id = ?`,
        [member.orgId],
      )

      const treatments = await db.getAll<{
        shelter_code: string | null
        treated_at: string
        treatment_type: string
        notes: string | null
      }>(
        `SELECT a.shelter_code, t.treated_at, t.treatment_type, t.notes
         FROM treatments t
         LEFT JOIN animals a ON a.id = t.animal_id
         WHERE t.org_id = ?`,
        [member.orgId],
      )

      const ledger = await db.getAll<{
        entry_date: string
        direction: string
        category: string | null
        amount_cents: number
        notes: string | null
        shelter_code: string | null
      }>(
        `SELECT e.entry_date, e.direction, c.label as category, e.amount_cents, e.notes, a.shelter_code
         FROM ledger_entries e
         LEFT JOIN ledger_categories c ON c.id = e.category_id
         LEFT JOIN animals a ON a.id = e.animal_id
         WHERE e.org_id = ?`,
        [member.orgId],
      )

      const images: { name: string; blob: Blob }[] = []
      for (const animal of animals) {
        const photos = await listPhotosForAnimal(db, animal.id)
        for (const photo of photos) {
          let blob = await getLocalPhoto(photo.id)
          if (!blob && photo.r2_key) {
            const url = publicPhotoUrl(photo.r2_key)
            if (url) {
              try {
                const res = await fetch(url)
                if (res.ok) blob = await res.blob()
              } catch (err) {
                console.warn('Skip missing image', photo.id, err)
              }
            }
          }
          if (blob) {
            images.push({
              name: `${animal.shelter_code}-${photo.id}.jpg`,
              blob,
            })
          } else {
            console.warn('Skip missing image', photo.id)
          }
        }
      }

      const zip = await buildExportZip({
        csvFiles: [
          {
            name: 'animals.csv',
            content: animalsToCsv(
              animals.map((a) => ({
                shelter_code: a.shelter_code,
                name: a.name,
                species: a.species,
                sex: a.sex,
                markings: a.markings,
                status: a.status_label,
                intake_date: a.intake_date,
                notes: a.notes,
              })),
            ),
          },
          { name: 'treatments.csv', content: treatmentsToCsv(treatments) },
          { name: 'ledger.csv', content: ledgerToCsv(ledger) },
        ],
        images,
      })

      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(zip)
      const a = document.createElement('a')
      a.href = url
      a.download = `sanctuary-export-${date}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Export downloaded')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportBusy(false)
    }
  }

  async function onLogout() {
    await disconnectPowerSync()
    await supabaseConnector.logout()
  }

  return (
    <section className="screen">
      <h1>Settings</h1>
      {member ? (
        <p className="muted">
          {member.orgName} · {member.role}
        </p>
      ) : (
        <p className="muted">Waiting for org membership to sync…</p>
      )}

      <h2>Animal statuses</h2>
      <form className="row" onSubmit={onAddStatus}>
        <input
          placeholder="New status label"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        />
        <button className="primary" type="submit">
          Add
        </button>
      </form>
      <div>
        {statuses
          .filter((s) => !s.archived)
          .map((s) => (
            <div className="list-item row" key={s.id}>
              <input
                value={s.label ?? ''}
                onChange={(e) => {
                  const label = e.target.value
                  setStatuses((prev) =>
                    prev.map((x) => (x.id === s.id ? { ...x, label } : x)),
                  )
                }}
                onBlur={(e) => {
                  if (!db) return
                  void renameStatus(db, s.id, e.target.value)
                }}
              />
              <button type="button" onClick={() => void moveStatus(s.id, -1)}>
                Up
              </button>
              <button type="button" onClick={() => void moveStatus(s.id, 1)}>
                Down
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!db) return
                  void archiveStatus(db, s.id).then(reload)
                }}
              >
                Archive
              </button>
            </div>
          ))}
      </div>

      <h2>Ledger categories</h2>
      <form className="stack" onSubmit={onAddCategory}>
        <div className="row">
          <input
            placeholder="New category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <select
            value={newCategoryDirection}
            onChange={(e) =>
              setNewCategoryDirection(e.target.value as LedgerDirection)
            }
          >
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
          <button className="primary" type="submit">
            Add
          </button>
        </div>
      </form>
      <div>
        {categories
          .filter((c) => !c.archived)
          .map((c) => (
            <div className="list-item row" key={c.id}>
              <input
                value={c.label ?? ''}
                onChange={(e) => {
                  const label = e.target.value
                  setCategories((prev) =>
                    prev.map((x) => (x.id === c.id ? { ...x, label } : x)),
                  )
                }}
                onBlur={(e) => {
                  if (!db) return
                  void renameLedgerCategory(db, c.id, e.target.value)
                }}
              />
              <span className="muted">{c.direction}</span>
              <button
                type="button"
                onClick={() => {
                  if (!db) return
                  void archiveLedgerCategory(db, c.id).then(reload)
                }}
              >
                Archive
              </button>
            </div>
          ))}
      </div>

      <h2>Data export</h2>
      <button
        type="button"
        className="primary"
        disabled={exportBusy || !member}
        onClick={() => void exportData()}
      >
        {exportBusy ? 'Exporting…' : 'Export my data'}
      </button>

      <h2>Support</h2>
      <p>
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </p>

      <h2>Account</h2>
      <button type="button" onClick={() => void onLogout()}>
        Sign out
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  )
}
