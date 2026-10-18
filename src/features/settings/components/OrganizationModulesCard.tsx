import { useState, useTransition } from 'react'
import {
  ALL_MODULE_IDS,
  type AppModuleId,
} from '@/shared/domain/modules'
import { Button } from '@/shared/ui/Button'
import { SettingsCardHead } from '@/features/settings/components/SettingsCardHead'

type ModuleDefinition = {
  id: AppModuleId
  label: string
  description: string
}

const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    id: 'reports',
    label: 'Rescue Reports',
    description:
      'Triage incoming rescue calls, dispatch field rescue teams, track response stages.',
  },
  {
    id: 'animals',
    label: 'Animal Records',
    description:
      'Shelter roster, care notes, medical history, life stages, and animal relationships.',
  },
  {
    id: 'checklist',
    label: 'Daily Checklist',
    description: 'Daily feeding, cleaning, and wellness task execution.',
  },
  {
    id: 'ledger',
    label: 'Financial Ledger',
    description:
      'Donations, medical expense tracking, receipt proof verification.',
  },
]

export type OrganizationModulesCardProps = {
  enabledModules: Set<AppModuleId>
  canManage: boolean
  onSave: (modules: AppModuleId[]) => Promise<void> | void
}

export function OrganizationModulesCard({
  enabledModules,
  canManage,
  onSave,
}: OrganizationModulesCardProps) {
  const [editing, setEditing] = useState(false)
  const [selectedModules, setSelectedModules] = useState<Set<AppModuleId>>(
    () => new Set(enabledModules),
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggleModule(moduleId: AppModuleId, checked: boolean) {
    const updated = new Set(selectedModules)
    if (checked) {
      updated.add(moduleId)
    } else {
      updated.delete(moduleId)
    }
    setSelectedModules(updated)
  }

  async function handleSave() {
    setStatusMessage(null)
    setErrorMessage(null)
    startTransition(async () => {
      try {
        const sortedList = ALL_MODULE_IDS.filter((m) => selectedModules.has(m))
        await onSave(sortedList)
        setStatusMessage('Modules saved successfully.')
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to update modules.',
        )
      }
    })
  }

  return (
    <div className="panel stack" style={{ marginBottom: '1.25rem' }}>
      <SettingsCardHead
        title="Organization modules"
        description={
          editing
            ? 'Enable or disable workspace features to match your operations.'
            : 'Active modules in your workspace.'
        }
        editing={editing}
        onToggle={() => {
          setStatusMessage(null)
          setErrorMessage(null)
          setEditing((open) => !open)
        }}
      />

      {editing ? (
        <>
          <div className="stack" style={{ gap: '0.75rem', marginTop: '0.25rem' }}>
            {MODULE_DEFINITIONS.map((def) => {
              const inputId = `module-${def.id}`
              const isChecked = selectedModules.has(def.id)
              return (
                <label
                  key={def.id}
                  htmlFor={inputId}
                  className="check-row"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    cursor: canManage && !isPending ? 'pointer' : 'default',
                    gap: '0.75rem',
                    padding: '0.5rem 0',
                    minHeight: '44px',
                  }}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canManage || isPending}
                    onChange={(e) => handleToggleModule(def.id, e.target.checked)}
                    style={{
                      marginTop: '0.2rem',
                      width: '1.25rem',
                      height: '1.25rem',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                      {def.label}
                    </span>
                    <span className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.35 }}>
                      {def.description}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>

          {canManage ? (
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                variant="primary"
                disabled={isPending}
                onClick={() => void handleSave()}
              >
                {isPending ? 'Saving…' : 'Save modules'}
              </Button>
            </div>
          ) : null}

          {statusMessage ? (
            <p className="muted" role="status" style={{ margin: 0, color: 'var(--color-forest)' }}>
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="form-error" role="alert" style={{ margin: 0 }}>
              {errorMessage}
            </p>
          ) : null}
        </>
      ) : (
        <div className="settings-groups">
          <div className="settings-group">
            <p className="settings-group__label">Enabled</p>
            <ul className="settings-group__items">
              {MODULE_DEFINITIONS.filter((def) => selectedModules.has(def.id)).map((def) => (
                <li key={def.id} className="settings-group__item">
                  <span>{def.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
