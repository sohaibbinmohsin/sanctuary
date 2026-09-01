import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@powersync/react'
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
  applyCountsAsInCareChange,
  countAnimalsWithStatusAndOthers,
  setStatusOutOfCareWithStrip,
} from '@/features/settings/domain/statusInCare'
import {
  archiveLedgerCategory,
  createLedgerCategory,
  listLedgerCategories,
  renameLedgerCategory,
  setLedgerCategoryDirection,
  type CurrencyCode,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import type { LedgerCategoryRecord } from '@/features/sync/powersync/schema'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { animalsToCsv, ledgerToCsv, treatmentsToCsv } from '@/shared/lib/export/csv'
import { buildExportZip } from '@/shared/lib/export/zipImages'
import {
  getLocalPhoto,
  listPhotosForAnimal,
} from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import {
  clearPartnerLogo,
  ensurePartnerLogoCached,
  getLocalPartnerLogo,
  setPartnerLogo,
} from '@/features/settings/domain/partnerLogo'
import {
  disablePublicPage,
  enablePublicPage,
  updatePublicSlug,
} from '@/features/settings/domain/publicPage'
import { publicShelterUrl } from '@/shared/lib/public/slug'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { InstallAppCard } from '@/shared/ui/InstallAppCard'
import { isPlaygroundMode } from '@/features/playground/mode'
import { ChecklistRemindersControl } from '@/features/checklist/components/ChecklistRemindersControl'
import { SortableStatusList } from '@/features/settings/components/SortableStatusList'
import {
  SettingsCardHead,
  SettingsCatalog,
} from '@/features/settings/components/SettingsCardHead'
import { HelpAndAccount } from '@/features/settings/components/HelpAndAccount'

export function SettingsScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [categories, setCategories] = useState<LedgerCategoryRecord[]>([])
  const [newStatus, setNewStatus] = useState('')
  const [newStatusInCare, setNewStatusInCare] = useState<'1' | '0'>('1')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryDirection, setNewCategoryDirection] =
    useState<LedgerDirection>('out')
  const [exportBusy, setExportBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState('')
  const [partnerNameError, setPartnerNameError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<CurrencyCode>(member?.currency ?? 'PKR')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [publicBusy, setPublicBusy] = useState(false)
  const [publicError, setPublicError] = useState<string | null>(null)
  const [slugDraft, setSlugDraft] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugEditorOpen, setSlugEditorOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [editingBranding, setEditingBranding] = useState(false)
  const [editingStatuses, setEditingStatuses] = useState(false)
  const [editingCategories, setEditingCategories] = useState(false)

  const { data: orgRows } = useQuery<{
    logo_r2_key: string | null
    public_enabled: number | null
    public_slug: string | null
  }>(
    member?.orgId
      ? `SELECT logo_r2_key, public_enabled, public_slug FROM organizations WHERE id = ?`
      : `SELECT logo_r2_key, public_enabled, public_slug FROM organizations WHERE 0`,
    member?.orgId ? [member.orgId] : [],
  )
  const logoR2Key = orgRows?.[0]?.logo_r2_key ?? null
  const publicEnabled = orgRows?.[0]?.public_enabled === 1
  const publicSlug = orgRows?.[0]?.public_slug ?? null

  async function reload() {
    if (!db || !member) return
    setStatuses(await listStatuses(db, member.orgId, true))
    setCategories(await listLedgerCategories(db, member.orgId, true))
  }

  useEffect(() => {
    void reload()
  }, [db, member])

  useEffect(() => {
    let cancelled = false

    async function loadLogo() {
      if (!member) {
        setLogoUrl(null)
        return
      }
      const blob = await ensurePartnerLogoCached(member.orgId, logoR2Key)
      if (cancelled) return
      if (!blob) {
        setLogoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        return
      }
      const url = URL.createObjectURL(blob)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    }

    void loadLogo()
    return () => {
      cancelled = true
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [member?.orgId, logoR2Key])

  useEffect(() => {
    if (member?.currency) setCurrency(member.currency)
  }, [member?.currency])

  async function onSaveCurrency(next: CurrencyCode) {
    if (!db || !member) return
    setCurrency(next)
    await db.execute(`UPDATE organizations SET currency = ? WHERE id = ?`, [
      next,
      member.orgId,
    ])
  }

  useEffect(() => {
    if (member?.orgName) setPartnerName(member.orgName)
  }, [member?.orgName])

  async function onSavePartnerName() {
    if (!db || !member) return
    const next = partnerName.trim()
    if (!next) {
      setPartnerNameError('Enter a partner name.')
      setPartnerName(member.orgName)
      return
    }
    setPartnerNameError(null)
    if (next === member.orgName) return
    await db.execute(`UPDATE organizations SET name = ? WHERE id = ?`, [
      next,
      member.orgId,
    ])
  }

  async function onPickLogo(file: File | undefined) {
    if (!db || !member || !file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file for the partner logo.')
      return
    }
    setLogoBusy(true)
    setLogoError(null)
    try {
      await setPartnerLogo(db, member.orgId, file)
      const blob = await getLocalPartnerLogo(member.orgId)
      if (blob) {
        setLogoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'Could not save partner logo.',
      )
    } finally {
      setLogoBusy(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function onRemoveLogo() {
    if (!db || !member) return
    const ok = await confirm({
      title: 'Remove partner logo?',
      body: 'It will be removed from Overview share images for your shelter.',
      confirmLabel: 'Remove logo',
      tone: 'danger',
    })
    if (!ok) return
    setLogoBusy(true)
    setLogoError(null)
    try {
      await clearPartnerLogo(db, member.orgId, logoR2Key)
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'Could not remove partner logo.',
      )
    } finally {
      setLogoBusy(false)
    }
  }

  useEffect(() => {
    setSlugDraft(publicSlug ?? '')
    setSlugError(null)
  }, [publicSlug])

  async function onTogglePublicPage(next: boolean) {
    if (!db || !member) return
    setPublicBusy(true)
    setPublicError(null)
    try {
      if (next) {
        await enablePublicPage(db, {
          orgId: member.orgId,
          orgName: member.orgName,
          initials: member.orgInitials,
        })
      } else {
        await disablePublicPage(db, member.orgId)
      }
    } catch (err) {
      setPublicError(
        err instanceof Error ? err.message : 'Could not update the public page.',
      )
    } finally {
      setPublicBusy(false)
    }
  }

  async function onCommitSlug(): Promise<boolean> {
    if (!db || !member) return false
    const next = slugDraft.trim()
    if (!next || next === (publicSlug ?? '')) return true
    setSlugSaving(true)
    setSlugError(null)
    try {
      await updatePublicSlug(db, member.orgId, next)
      return true
    } catch (err) {
      setSlugError(
        err instanceof Error ? err.message : 'Could not save that link.',
      )
      return false
    } finally {
      setSlugSaving(false)
    }
  }

  function openSlugEditor() {
    setSlugDraft(publicSlug ?? '')
    setSlugError(null)
    setSlugEditorOpen(true)
  }

  function closeSlugEditor() {
    setSlugEditorOpen(false)
    setSlugDraft(publicSlug ?? '')
    setSlugError(null)
  }

  async function onSaveSlugFromEditor() {
    const saved = await onCommitSlug()
    if (saved) setSlugEditorOpen(false)
  }

  async function onCopyPublicLink() {
    const slug = publicSlug?.trim()
    if (!slug) return
    const url = publicShelterUrl(slug)
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('Link copied')
    } catch {
      setCopyMessage('Could not copy link')
    } finally {
      window.setTimeout(() => setCopyMessage(null), 2000)
    }
  }

  async function onAddStatus(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !newStatus.trim()) return
    setStatusError(null)
    try {
      await createStatus(db, {
        orgId: member.orgId,
        label: newStatus,
        countsAsInCare: newStatusInCare === '1',
      })
      setNewStatus('')
      setNewStatusInCare('1')
      await reload()
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Could not add status.',
      )
    }
  }

  async function onReorderStatuses(orderedIds: string[]) {
    if (!db) return
    setStatuses((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]))
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((s): s is AnimalStatus => Boolean(s))
      const archived = prev.filter((s) => s.archived)
      return [...reordered, ...archived]
    })
    await reorderStatuses(db, orderedIds)
  }

  async function onAddCategory(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !newCategory.trim()) return
    setCategoryError(null)
    try {
      await createLedgerCategory(db, {
        orgId: member.orgId,
        label: newCategory,
        direction: newCategoryDirection,
      })
      setNewCategory('')
      await reload()
    } catch (err) {
      setCategoryError(
        err instanceof Error ? err.message : 'Could not add category.',
      )
    }
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
  const activeStatuses = statuses.filter((s) => !s.archived)
  const activeCategories = categories.filter((c) => !c.archived)
  const partnerDisplayName = partnerName.trim()
  const partnerMark = (
    member?.orgInitials ||
    partnerDisplayName.slice(0, 2) ||
    '?'
  ).slice(0, 3)

  return (
    <section className="screen">
      <PageHeader
        title="Settings"
        subtitle={
          member
            ? 'Partner branding, statuses, and reminders for your team.'
            : 'Waiting for your shelter info to load…'
        }
      />

      <div className="panel stack" style={{ marginBottom: '1.25rem' }}>
        <SettingsCardHead
          title="Partner name and logo"
          description="Used on share images and your public page."
          editing={editingBranding}
          onToggle={() => {
            if (editingBranding) void onSavePartnerName()
            setEditingBranding((open) => !open)
          }}
        />
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onPickLogo(e.target.files?.[0])}
        />
        {editingBranding ? (
          <>
            <label className="stack" style={{ gap: '0.35rem' }}>
              <span className="muted" style={{ fontSize: '0.875rem' }}>
                Partner name
              </span>
              <input
                value={partnerName}
                disabled={!member}
                onChange={(e) => {
                  setPartnerName(e.target.value)
                  if (partnerNameError) setPartnerNameError(null)
                }}
                onBlur={() => void onSavePartnerName()}
                aria-label="Partner name"
              />
            </label>
            {partnerNameError ? (
              <p className="form-error">{partnerNameError}</p>
            ) : null}
            <div style={{ maxWidth: '16rem' }}>
              <SelectField
                label="Shelter currency"
                value={currency}
                options={[
                  { value: 'PKR', label: 'PKR (Pakistani Rupee)' },
                  { value: 'USD', label: 'USD (US Dollar)' },
                ]}
                onChange={(val) => void onSaveCurrency(val as CurrencyCode)}
              />
            </div>
            {logoUrl ? (
              <img
                className="partner-logo-preview"
                src={logoUrl}
                alt="Partner logo"
              />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No logo yet.
              </p>
            )}
            <div className="row">
              <Button
                type="button"
                variant="secondary"
                disabled={!member || logoBusy}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoBusy ? 'Saving…' : logoUrl ? 'Replace logo' : 'Add logo'}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="danger-ghost"
                  disabled={logoBusy}
                  onClick={() => void onRemoveLogo()}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            {logoError ? <p className="form-error">{logoError}</p> : null}
          </>
        ) : (
          <div className="settings-identity">
            {logoUrl ? (
              <img
                className="settings-identity__mark"
                src={logoUrl}
                alt=""
              />
            ) : (
              <div
                className="settings-identity__mark settings-identity__mark--fallback"
                aria-hidden
              >
                {partnerMark}
              </div>
            )}
            <div className="settings-identity__copy">
              <p
                className={
                  partnerDisplayName
                    ? 'settings-identity__name'
                    : 'settings-identity__name settings-identity__name--empty'
                }
              >
                {partnerDisplayName || 'No partner name yet'}
              </p>
              <p className="muted settings-identity__hint" style={{ marginTop: '0.2rem' }}>
                Currency: {currency}
              </p>
              {logoUrl ? null : (
                <p className="muted settings-identity__hint">No logo yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="settings-grid">
        <div className="panel stack">
          <SettingsCardHead
            title="Animal statuses"
          description={
            editingStatuses
              ? 'Labels like Quarantine or Adopted. Drag to reorder; mark in care or not.'
              : 'Labels like Quarantine or Adopted.'
          }
            editing={editingStatuses}
            onToggle={() => setEditingStatuses((open) => !open)}
          />
          {editingStatuses ? (
            <>
          <form className="stack" onSubmit={onAddStatus}>
            <div className="row">
              <input
                placeholder="New status name"
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value)
                  if (statusError) setStatusError(null)
                }}
                aria-label="New status name"
                style={{ flex: 1, minWidth: '8rem' }}
              />
              <div style={{ minWidth: '8.5rem', flex: '0 0 auto' }}>
                <SelectField
                  label="In care"
                  hideLabel
                  value={newStatusInCare}
                  options={[
                    { value: '1', label: 'In care' },
                    { value: '0', label: 'Not in care' },
                  ]}
                  onChange={(value) => setNewStatusInCare(value as '1' | '0')}
                />
              </div>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </div>
            {statusError ? <p className="form-error">{statusError}</p> : null}
          </form>
          <SortableStatusList
            statuses={statuses}
            onReorder={(orderedIds) => void onReorderStatuses(orderedIds)}
            onLabelChange={(id, label) => {
              setStatuses((prev) =>
                prev.map((x) => (x.id === id ? { ...x, label } : x)),
              )
            }}
            onRename={(id, label) => {
              if (!db) return
              void renameStatus(db, id, label)
            }}
            onInCareChange={(id, countsAsInCare) => {
              const previousInCare =
                statuses.find((s) => s.id === id)?.counts_as_in_care ?? 1
              const statusLabel =
                statuses.find((s) => s.id === id)?.label ?? 'status'
              setStatuses((prev) =>
                prev.map((x) =>
                  x.id === id
                    ? { ...x, counts_as_in_care: countsAsInCare ? 1 : 0 }
                    : x,
                ),
              )
              if (!db) return
              void (async () => {
                const result = await applyCountsAsInCareChange(db, {
                  statusId: id,
                  countsAsInCare,
                })
                if (result !== 'needs_strip_confirm') return

                const count = await countAnimalsWithStatusAndOthers(db, id)
                const ok = await confirm({
                  title: `Save “${statusLabel}” as out of care?`,
                  body: `${count} animals also have other statuses. Save as out of care and remove those other statuses?`,
                  confirmLabel: 'Save and remove',
                  tone: 'danger',
                })
                if (!ok) {
                  setStatuses((prev) =>
                    prev.map((x) =>
                      x.id === id
                        ? { ...x, counts_as_in_care: previousInCare }
                        : x,
                    ),
                  )
                  return
                }
                await setStatusOutOfCareWithStrip(db, {
                  statusId: id,
                  stripOthers: true,
                })
              })()
            }}
            onHide={(s) => {
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
          />
            </>
          ) : (
            <SettingsCatalog
              empty="No statuses yet."
              groups={[
                {
                  label: 'In care',
                  items: activeStatuses
                    .filter((s) => s.counts_as_in_care)
                    .map((s) => ({ id: s.id, name: s.label })),
                },
                {
                  label: 'Not in care',
                  items: activeStatuses
                    .filter((s) => !s.counts_as_in_care)
                    .map((s) => ({ id: s.id, name: s.label })),
                },
              ]}
            />
          )}
        </div>

        <div className="panel stack">
          <SettingsCardHead
            title="Ledger categories"
          description={
            editingCategories
              ? 'Labels like Donation or Food. Mark each as money in or out.'
              : 'Labels like Donation or Food.'
          }
            editing={editingCategories}
            onToggle={() => setEditingCategories((open) => !open)}
          />
          {editingCategories ? (
            <>
          <form className="stack" onSubmit={onAddCategory}>
            <div className="row">
              <input
                placeholder="New category"
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value)
                  if (categoryError) setCategoryError(null)
                }}
                aria-label="New ledger category"
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
            {categoryError ? (
              <p className="form-error">{categoryError}</p>
            ) : null}
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
                  <div style={{ minWidth: '8.5rem', flex: '0 0 auto' }}>
                    <SelectField
                      label="Direction"
                      hideLabel
                      value={(c.direction as LedgerDirection) ?? 'out'}
                      options={[
                        { value: 'in', label: 'Money in' },
                        { value: 'out', label: 'Money out' },
                      ]}
                      onChange={(value) => {
                        const direction = value as LedgerDirection
                        setCategories((prev) =>
                          prev.map((x) =>
                            x.id === c.id ? { ...x, direction } : x,
                          ),
                        )
                        if (!db) return
                        void setLedgerCategoryDirection(db, c.id, direction)
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="danger-ghost"
                    onClick={() => {
                      if (!db) return
                      void (async () => {
                        const ok = await confirm({
                          title: `Hide “${c.label}”?`,
                          body: 'It will no longer show when adding ledger entries.',
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
            </>
          ) : (
            <SettingsCatalog
              empty="No categories yet."
              groups={[
                {
                  label: 'Money in',
                  items: activeCategories
                    .filter((c) => c.direction === 'in')
                    .map((c) => ({ id: c.id, name: c.label ?? 'Category' })),
                },
                {
                  label: 'Money out',
                  items: activeCategories
                    .filter((c) => c.direction !== 'in')
                    .map((c) => ({ id: c.id, name: c.label ?? 'Category' })),
                },
              ]}
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <InstallAppCard />
      </div>

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <div className="section-copy">
          <p className="section-label">Public transparency</p>
          {playground ? (
            <p className="muted" style={{ margin: 0 }}>
              In a real shelter account, you can turn on a public page donors
              open by link. It shows animals in care and ledger totals, while
              private care notes and anonymous proofs stay hidden when you mark
              them. Verified camera photos get a trust mark on that page.
              Public pages are not available in the playground.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Donors can open this link. Private care notes and anonymous
              proofs stay hidden when you mark them.
            </p>
          )}
        </div>
        {playground ? null : (
          <>
            {publicEnabled ? (
              <div className="public-link">
                <div className="row public-link__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!publicSlug}
                    onClick={() => void onCopyPublicLink()}
                  >
                    {copyMessage === 'Link copied' ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!member}
                    onClick={openSlugEditor}
                  >
                    Edit link
                  </Button>
                  <Button
                    type="button"
                    variant="danger-outline"
                    disabled={!member || publicBusy}
                    onClick={() => void onTogglePublicPage(false)}
                  >
                    {publicBusy ? 'Turning off…' : 'Turn off'}
                  </Button>
                </div>
                {copyMessage && copyMessage !== 'Link copied' ? (
                  <p className="muted public-link__status">{copyMessage}</p>
                ) : null}
              </div>
            ) : (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={!member || publicBusy}
                  onChange={(e) => void onTogglePublicPage(e.target.checked)}
                />
                <span>Enable public page</span>
              </label>
            )}
            {publicError ? <p className="form-error">{publicError}</p> : null}
          </>
        )}
      </div>

      {slugEditorOpen && !playground
        ? createPortal(
            <PublicSlugEditorDialog
              slug={slugDraft}
              saving={slugSaving}
              error={slugError}
              onSlugChange={(value) => {
                setSlugDraft(value)
                if (slugError) setSlugError(null)
              }}
              onSave={() => void onSaveSlugFromEditor()}
              onCancel={closeSlugEditor}
            />,
            document.body,
          )
        : null}

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <p className="section-label">Your data</p>
        <p className="muted" style={{ margin: 0 }}>
          Download a zip of animal records, care notes, ledger entries, and photos.
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
        <div className="section-copy">
          <p className="section-label">Checklist reminders</p>
          <p className="muted" style={{ margin: 0 }}>
            Choose whether this device gets evening and morning nudges. You can
            change this anytime.
          </p>
        </div>
        <ChecklistRemindersControl />
      </div>

      <HelpAndAccount variant="cards" />
    </section>
  )
}

type PublicSlugEditorDialogProps = {
  slug: string
  saving: boolean
  error: string | null
  onSlugChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}

function PublicSlugEditorDialog({
  slug,
  saving,
  error,
  onSlugChange,
  onSave,
  onCancel,
}: PublicSlugEditorDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel, saving])

  return (
    <div className="confirm-root" role="presentation">
      <button
        type="button"
        className="confirm-backdrop"
        aria-label="Dismiss"
        disabled={saving}
        onClick={onCancel}
      />
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <h2 id={titleId} className="confirm-card__title">
          Edit public link
        </h2>
        <p id={bodyId} className="confirm-card__body">
          Change the ending of your public page URL. Donors use this link to
          open your shelter page.
        </p>
        <div className="public-link-editor">
          <input
            ref={inputRef}
            className="public-link-editor__slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSave()
              }
            }}
            aria-label="Public page path"
            placeholder="your-shelter"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={saving}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="confirm-card__actions">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saving || !slug.trim()}
            onClick={onSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
