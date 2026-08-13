import { Button } from '@/shared/ui/Button'

type SettingsCardHeadProps = {
  title: string
  description: string
  editing: boolean
  onToggle: () => void
}

export function SettingsCardHead({
  title,
  description,
  editing,
  onToggle,
}: SettingsCardHeadProps) {
  return (
    <div className="settings-card-head">
      <div className="section-copy">
        <p className="section-label">{title}</p>
        <p className="muted" style={{ margin: 0 }}>
          {description}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="settings-card-head__action"
        aria-expanded={editing}
        onClick={onToggle}
      >
        {editing ? 'Done' : 'Edit'}
      </Button>
    </div>
  )
}

type CatalogGroup = {
  label: string
  items: { id: string; name: string }[]
}

export function SettingsCatalog({
  groups,
  empty,
}: {
  groups: CatalogGroup[]
  empty: string
}) {
  const visible = groups.filter((group) => group.items.length > 0)
  if (visible.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>{empty}</p>
  }

  return (
    <div className="settings-groups">
      {visible.map((group) => (
        <div key={group.label} className="settings-group">
          <p className="settings-group__label">{group.label}</p>
          <ul className="settings-group__items">
            {group.items.map((item) => (
              <li key={item.id} className="settings-group__item">
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
