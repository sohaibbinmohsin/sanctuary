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
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { InstallAppCard } from '@/shared/ui/InstallAppCard'
import { isPlaygroundMode } from '@/features/playground/mode'
import { resetPlaygroundSeed } from '@/features/playground/seed'
import { getPowerSyncDb } from '@/features/sync/powersync/database'

export function SettingsScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
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
      setMessage('Your records downloaded.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Download failed. Try again.')
    } finally {
      setExportBusy(false)
    }
  }

  const playground = isPlaygroundMode()

  async function onLogout() {
    await disconnectPowerSync()
    await supabaseConnector.logout()
    window.location.assign('/')
  }

  async function onResetPlayground() {
    const ok = await confirm({
      title: 'Reset playground?',
      body: 'Demo animals and money entries will be restored. Your playground edits on this device will be cleared.',
      confirmLabel: 'Reset demo data',
      tone: 'danger',
    })
    if (!ok) return
    const powerSync = getPowerSyncDb({ playground: true })
    await resetPlaygroundSeed(powerSync)
    window.location.assign('/playground/animals')
  }

  return (
    <section className="screen">
      <PageHeader
        title="Settings"
        subtitle={
          member
            ? `${member.orgName} · ${member.role}`
            : 'Waiting for your shelter info to load…'
        }
      />

      <div className="settings-grid">
        <div className="panel stack">
          <p className="section-label">Animal statuses</p>
          <p className="muted" style={{ margin: 0 }}>
            Labels like Quarantine or In care. Drag order with Up and Down.
          </p>
          <form className="row" onSubmit={onAddStatus}>
            <input
              placeholder="New status name"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              aria-label="New status name"
              style={{ flex: 1, minWidth: '8rem' }}
            />
            <Button type="submit" variant="secondary">
              Add
            </Button>
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
                    aria-label="Status name"
                    style={{ flex: 1, minWidth: '6rem' }}
                  />
                  <Button type="button" variant="ghost" onClick={() => void moveStatus(s.id, -1)}>
                    Up
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void moveStatus(s.id, 1)}>
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="danger-ghost"
                    onClick={() => {
                      if (!db) return
                      void (async () => {
                        const ok = await confirm({
                          title: `Hide “${s.label}”?`,
                          body: 'It will no longer show when adding or updating animals.',
                          confirmLabel: 'Hide status',
                          tone: 'danger',
                        })
                        if (!ok) return
                        await archiveStatus(db, s.id)
                        await reload()
                      })()
                    }}
                  >
                    Hide
                  </Button>
                </div>
              ))}
          </div>
        </div>

        <div className="panel stack">
          <p className="section-label">Money categories</p>
          <form className="stack" onSubmit={onAddCategory}>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <input
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                aria-label="New money category"
                style={{ flex: 1, minWidth: '8rem' }}
              />
              <div style={{ minWidth: '8.5rem', flex: '0 0 auto' }}>
                <SelectField
                  label="Direction"
                  hideLabel
                  value={newCategoryDirection}
                  options={[
                    { value: 'in', label: 'Money in' },
                    { value: 'out', label: 'Money out' },
                  ]}
                  onChange={(value) =>
                    setNewCategoryDirection(value as LedgerDirection)
                  }
                />
              </div>
              <Button type="submit" variant="secondary">
                Add
              </Button>
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
                    aria-label="Category name"
                    style={{ flex: 1, minWidth: '6rem' }}
                  />
                  <span className="muted">
                    {c.direction === 'in' ? 'in' : 'out'}
                  </span>
                  <Button
                    type="button"
                    variant="danger-ghost"
                    onClick={() => {
                      if (!db) return
                      void (async () => {
                        const ok = await confirm({
                          title: `Hide “${c.label}”?`,
                          body: 'It will no longer show when adding money entries.',
                          confirmLabel: 'Hide category',
                          tone: 'danger',
                        })
                        if (!ok) return
                        await archiveLedgerCategory(db, c.id)
                        await reload()
                      })()
                    }}
                  >
                    Hide
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <InstallAppCard />
      </div>

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <p className="section-label">Your data</p>
        <p className="muted" style={{ margin: 0 }}>
          Download a zip of animal records, care notes, money entries, and photos.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={exportBusy || !member}
          onClick={() => void exportData()}
        >
          {exportBusy ? 'Preparing download…' : 'Download my records'}
        </Button>
        {message ? <p className="muted">{message}</p> : null}
      </div>

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <p className="section-label">Help</p>
        <p style={{ margin: 0 }}>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      </div>

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <p className="section-label">{playground ? 'Playground' : 'Account'}</p>
        {playground ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Demo data stays on this device. Reset anytime, or leave to sign in to your shelter.
            </p>
            <Button type="button" variant="secondary" onClick={() => void onResetPlayground()}>
              Reset demo data
            </Button>
            <Button type="button" variant="danger-outline" onClick={() => window.location.assign('/')}>
              Exit playground
            </Button>
          </>
        ) : (
          <Button type="button" variant="danger-outline" onClick={() => void onLogout()}>
            Sign out
          </Button>
        )}
      </div>
    </section>
  )
}
