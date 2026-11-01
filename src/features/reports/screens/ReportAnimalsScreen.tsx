import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, PawPrint } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EmptyState } from '@/shared/ui/EmptyState'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import {
  getRescueReportById,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import {
  getReportAnimals,
  type ReportAnimalItem,
} from '@/features/reports/domain/reportOutcomes'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import '@/features/reports/reports.css'

export function ReportAnimalsScreen() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const { member } = useCurrentMember()

  const [report, setReport] = useState<RescueReport | null>(null)
  const [animals, setAnimals] = useState<ReportAnimalItem[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [verifiedAnimalIds, setVerifiedAnimalIds] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !id) return
    let active = true

    async function loadData() {
      try {
        setLoading(true)
        const loadedReport = await getRescueReportById(db, id!)
        if (!active) return
        setReport(loadedReport)

        if (loadedReport) {
          const loadedAnimals = await getReportAnimals(db, loadedReport)
          if (!active) return
          setAnimals(loadedAnimals)

          if (loadedAnimals.length > 0 && member?.orgId) {
            const placeholders = loadedAnimals.map(() => '?').join(', ')
            const photoRows = await db.getAll<{
              id: string
              animal_id: string | null
              r2_key: string | null
              verified: number | boolean | null
            }>(
              `SELECT id, animal_id, r2_key, verified
               FROM photos
               WHERE org_id = ? AND animal_id IN (${placeholders})
               ORDER BY created_at DESC`,
              [member.orgId, ...loadedAnimals.map((a) => a.id)],
            )

            const urls: Record<string, string> = {}
            const verified: Record<string, boolean> = {}
            const needLocal: { animalId: string; photoId: string }[] = []

            for (const p of photoRows) {
              if (!p.animal_id) continue
              if (p.verified) verified[p.animal_id] = true
              if (!urls[p.animal_id]) {
                const remote = publicPhotoUrl(p.r2_key)
                if (remote) {
                  urls[p.animal_id] = remote
                } else {
                  needLocal.push({ animalId: p.animal_id, photoId: p.id })
                }
              }
            }

            for (const item of needLocal) {
              if (urls[item.animalId]) continue
              const local = await getLocalPhoto(item.photoId)
              if (local) {
                urls[item.animalId] = URL.createObjectURL(local)
              }
            }

            if (active) {
              setPhotoUrls(urls)
              setVerifiedAnimalIds(verified)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load group report animals', err)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      active = false
    }
  }, [db, id, member?.orgId])

  if (loading) {
    return (
      <div className="reports-screen">
        <div className="reports-detail-wrap">
          <p className="muted" style={{ padding: '2rem 1rem' }}>
            Loading report animals…
          </p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="reports-screen">
        <div className="reports-detail-wrap">
          <EmptyState
            title="Report not found"
            body="The requested rescue report could not be found."
            actionLabel="Back to reports"
            actionTo="/reports"
          />
        </div>
      </div>
    )
  }

  const reportTitle = report.report_number
    ? `${report.report_number} · Group Animals`
    : 'Report Animals'

  return (
    <div className="reports-screen">
      <div className="reports-detail-wrap">
        <div className="case-detail-topbar">
          <Link to={`/reports/${report.id}`} className="back-link">
            <ArrowLeft size={18} weight="bold" aria-hidden />
            <span>{report.report_number || 'Report'}</span>
          </Link>
        </div>

        <PageHeader
          title={reportTitle}
          subtitle={`${animals.length} animal${animals.length === 1 ? '' : 's'} admitted from this rescue`}
        />

        {animals.length === 0 ? (
          <EmptyState
            icon={<PawPrint size={28} weight="duotone" />}
            title="No animals linked yet"
            body="Animals admitted for this report will appear here."
            actionLabel="View report"
            actionTo={`/reports/${report.id}`}
          />
        ) : (
          <div className="animal-grid" style={{ marginTop: '1rem' }}>
            {animals.map((animal) => (
              <AnimalCard
                key={animal.id}
                animal={animal}
                photoUrl={photoUrls[animal.id]}
                hasVerifiedPhoto={Boolean(verifiedAnimalIds[animal.id])}
                to={`/animals/${animal.id}?from_group_report=${report.id}`}
                linkState={{
                  backTo: `/reports/${report.id}/animals`,
                  backLabel: 'Group Animals',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
