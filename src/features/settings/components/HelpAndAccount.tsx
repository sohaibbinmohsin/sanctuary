import {
  ArrowSquareOut,
  ArrowsClockwise,
  Question,
  SignOut,
} from '@phosphor-icons/react'
import { getSupportEmail } from '@/shared/lib/supabase'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { disconnectPowerSync, getPowerSyncDb } from '@/features/sync/powersync/database'
import { isPlaygroundMode } from '@/features/playground/mode'
import { resetPlaygroundSeed } from '@/features/playground/seed'
import { useConfirm } from '@/shared/ui/ConfirmDialog'

function ActionIcon({
  icon: Icon,
}: {
  icon: typeof Question
}) {
  return <Icon weight="duotone" aria-hidden />
}

export function HelpAndAccount({
  variant,
}: {
  variant: 'cards' | 'sidebar'
}) {
  const playground = isPlaygroundMode()
  const supportEmail = getSupportEmail()
  const confirm = useConfirm()

  async function onLogout() {
    const ok = await confirm({
      title: 'Sign out?',
      body: 'You’ll need to sign in again to use Sanctuary on this device.',
      confirmLabel: 'Sign out',
      tone: 'danger',
    })
    if (!ok) return
    await disconnectPowerSync()
    await supabaseConnector.logout()
    window.location.assign('/')
  }

  async function onResetPlayground() {
    const ok = await confirm({
      title: 'Reset playground?',
      body: 'Demo animals and ledger entries will be restored. Your playground edits on this device will be cleared.',
      confirmLabel: 'Reset',
      tone: 'danger',
    })
    if (!ok) return
    const powerSync = getPowerSyncDb({ playground: true })
    await resetPlaygroundSeed(powerSync)
    window.location.assign('/playground/animals')
  }

  const actions = playground ? (
    <>
      <a
        className="help-account__action"
        href="https://www.themohsinproject.org/#apply?type=partner"
        target="_blank"
        rel="noopener noreferrer"
      >
        <ActionIcon icon={ArrowSquareOut} />
        <span>Request access</span>
      </a>
      <button
        type="button"
        className="help-account__action"
        onClick={() => void onResetPlayground()}
      >
        <ActionIcon icon={ArrowsClockwise} />
        <span>Reset</span>
      </button>
      <button
        type="button"
        className="help-account__action"
        onClick={() => window.location.assign('/')}
      >
        <ActionIcon icon={SignOut} />
        <span>Exit playground</span>
      </button>
    </>
  ) : (
    <button
      type="button"
      className="help-account__action"
      onClick={() => void onLogout()}
    >
      <ActionIcon icon={SignOut} />
      <span>Sign out</span>
    </button>
  )

  return (
    <div
      className={
        variant === 'cards'
          ? 'help-account help-account--cards'
          : 'help-account help-account--sidebar'
      }
    >
      <button
        type="button"
        className="help-account__action"
        onClick={() => {
          window.location.assign(`mailto:${supportEmail}`)
        }}
      >
        <ActionIcon icon={Question} />
        <span>Help</span>
      </button>
      {actions}
    </div>
  )
}
