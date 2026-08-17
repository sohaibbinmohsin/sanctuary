import { DotsThree, DownloadSimple } from '@phosphor-icons/react'
import { usePwaInstall } from '@/shared/hooks/usePwaInstall'
import { Button } from '@/shared/ui/Button'

function IosShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Share"
      style={{ verticalAlign: '-0.2em' }}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function InstallAppCard() {
  const { canInstall, installed, iosHint, promptInstall } = usePwaInstall()

  if (installed) {
    return (
      <div className="panel stack">
        <p className="section-label">Install app</p>
        <p className="muted" style={{ margin: 0 }}>
          Sanctuary is installed on this device. Open it from your home screen
          for the full offline experience.
        </p>
      </div>
    )
  }

  return (
    <div className="panel stack">
      <p className="section-label">Install app</p>
      {canInstall ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Add Sanctuary to your home screen for faster access and better
            offline use.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void promptInstall()}
          >
            <DownloadSimple size={18} weight="bold" aria-hidden />
            Install Sanctuary
          </Button>
        </>
      ) : iosHint ? (
        <div className="stack stack--tight">
          <p className="muted" style={{ margin: 0 }}>
            On iPhone or iPad:
          </p>
          <ol className="muted" style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
            <li>
              Tap <IosShareIcon /> Share
            </li>
            <li>
              Tap{' '}
              <DotsThree
                size={20}
                weight="bold"
                aria-label="More"
                style={{ verticalAlign: '-0.35em' }}
              />
            </li>
            <li>
              Tap <strong>Add to Home Screen</strong>
            </li>
          </ol>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          In Chrome or Edge, open the browser menu and choose{' '}
          <strong>Install Sanctuary</strong> (or the install icon in the
          address bar).
        </p>
      )}
    </div>
  )
}
