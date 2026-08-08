import { DownloadSimple, ShareNetwork } from '@phosphor-icons/react'
import { usePwaInstall } from '@/shared/hooks/usePwaInstall'
import { Button } from '@/shared/ui/Button'

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
        <p className="muted" style={{ margin: 0 }}>
          On iPhone or iPad: tap{' '}
          <ShareNetwork
            size={16}
            weight="bold"
            aria-label="Share"
            style={{ verticalAlign: '-0.2em' }}
          />{' '}
          Share, then <strong>Add to Home Screen</strong>.
        </p>
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
