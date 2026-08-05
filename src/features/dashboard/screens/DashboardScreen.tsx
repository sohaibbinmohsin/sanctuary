import { useEffect, useRef, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { countInCare } from '@/features/animals/domain/animals'
import { formatPkr, sumLedger } from '@/features/ledger/domain/ledger'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { DASHBOARD_GREETINGS, pickMessage } from '@/shared/lib/morale/messages'
import { renderDashboardImage } from '@/shared/lib/share/dashboardImage'
import { MoraleToast } from '@/shared/ui/MoraleToast'

const GREETING_KEY = 'sanctuary.dashboardGreetingShown'

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = new Date(y, m, 1).toISOString().slice(0, 10)
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function DashboardScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const cardRef = useRef<HTMLDivElement>(null)
  const [headcount, setHeadcount] = useState(0)
  const [money, setMoney] = useState({ inCents: 0, outCents: 0 })
  const [greeting, setGreeting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !member) return
    const range = monthRange()
    void countInCare(db, member.orgId).then(setHeadcount)
    void sumLedger(db, member.orgId, range).then(setMoney)

    if (!sessionStorage.getItem(GREETING_KEY)) {
      sessionStorage.setItem(GREETING_KEY, '1')
      setGreeting(pickMessage(DASHBOARD_GREETINGS))
    }
  }, [db, member])

  const summaryText = [
    member?.orgName ?? 'Sanctuary',
    `In care: ${headcount}`,
    `This month in: ${formatPkr(money.inCents)}`,
    `This month out: ${formatPkr(money.outCents)}`,
  ].join('\n')

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText)
    setToast('Summary copied')
  }

  async function downloadPng() {
    if (!cardRef.current) return
    const blob = await renderDashboardImage(cardRef.current)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sanctuary-dashboard-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    URL.revokeObjectURL(url)
    setToast('Dashboard image downloaded')
  }

  async function shareImage() {
    if (!cardRef.current) return
    const blob = await renderDashboardImage(cardRef.current)
    const file = new File([blob], 'sanctuary-dashboard.png', {
      type: 'image/png',
    })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: member?.orgName ?? 'Sanctuary',
        text: summaryText,
      })
      setToast('Shared')
    } else {
      await downloadPng()
    }
  }

  return (
    <section className="screen">
      <h1>Dashboard</h1>
      {greeting ? <p className="muted">{greeting}</p> : null}

      <div className="dashboard-card" ref={cardRef}>
        <h2 style={{ marginTop: 0 }}>{member?.orgName ?? 'Your shelter'}</h2>
        <p style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{headcount}</p>
        <p className="muted">animals in care</p>
        <div className="row" style={{ marginTop: '1rem' }}>
          <div>
            <div className="muted">Month in</div>
            <strong>{formatPkr(money.inCents)}</strong>
          </div>
          <div>
            <div className="muted">Month out</div>
            <strong>{formatPkr(money.outCents)}</strong>
          </div>
        </div>
        <div className="powered-by">Powered by Sanctuary</div>
      </div>

      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" className="primary" onClick={() => void copySummary()}>
          Copy summary
        </button>
        <button type="button" className="primary" onClick={() => void downloadPng()}>
          Download PNG
        </button>
        <button type="button" className="primary" onClick={() => void shareImage()}>
          Share
        </button>
      </div>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
