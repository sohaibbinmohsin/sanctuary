type StatusBadgeProps = {
  label: string
  tone?: 'default' | 'amber' | 'muted'
}

function toneFromLabel(label: string): StatusBadgeProps['tone'] {
  const lower = label.toLowerCase()
  if (
    lower.includes('quarantine') ||
    lower.includes('urgent') ||
    lower.includes('critical') ||
    lower.includes('treatment')
  ) {
    return 'amber'
  }
  if (
    lower.includes('passed') ||
    lower.includes('archived') ||
    lower.includes('adopted') ||
    lower.includes('released')
  ) {
    return 'muted'
  }
  return 'default'
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const resolved = tone ?? toneFromLabel(label)
  const className =
    resolved === 'amber'
      ? 'status-badge status-badge--amber'
      : resolved === 'muted'
        ? 'status-badge status-badge--muted'
        : 'status-badge'
  return <span className={className}>{label}</span>
}
