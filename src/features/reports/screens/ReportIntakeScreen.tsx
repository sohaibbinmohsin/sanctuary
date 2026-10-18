import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField, TextareaField } from '@/shared/ui/Field'
import {
  IntakePhotoPicker,
  type StagedPhoto,
} from '@/features/animals/components/IntakePhotoPicker'
import {
  createRescueReport,
  generateReportNumber,
  addReportPhoto,
} from '@/features/reports/domain/rescueReports'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other'] as const

export function ReportIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()

  const [speciesPreset, setSpeciesPreset] = useState<string>('Dog')
  const [speciesOther, setSpeciesOther] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [locationArea, setLocationArea] = useState('')
  const [locationLandmark, setLocationLandmark] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orgId = member?.orgId ?? ''
  const orgInitials = member?.orgInitials ?? 'SANCTUARY'

  const effectiveSpecies =
    speciesPreset === 'Other'
      ? speciesOther.trim() || 'Other'
      : speciesPreset

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !orgId) {
      setError('Database or organization not ready.')
      return
    }

    const complaintTrimmed = chiefComplaint.trim()
    const areaTrimmed = locationArea.trim()

    if (!complaintTrimmed) {
      setError('Please provide a chief complaint or injury description.')
      return
    }

    if (!areaTrimmed) {
      setError('Please provide a location area.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const reportNumber = await generateReportNumber(db, orgInitials)
      const report = await createRescueReport(db, {
        orgId,
        reportNumber,
        species: effectiveSpecies.toLowerCase(),
        chiefComplaint: complaintTrimmed,
        locationArea: areaTrimmed,
        locationLandmark: locationLandmark.trim() || null,
        reporterName: reporterName.trim() || null,
        reporterPhone: reporterPhone.trim() || null,
      })

      // Attach any staged photos to this report
      if (stagedPhotos.length > 0) {
        for (const photo of stagedPhotos) {
          await addReportPhoto(db, {
            orgId,
            reportId: report.id,
            blob: photo.blob,
          })
        }
      }

      navigate(`/reports/${report.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rescue report.')
      setSubmitting(false)
    }
  }

  function handleAddPhotos(newPhotos: StagedPhoto[]) {
    setStagedPhotos((prev) => [...prev, ...newPhotos])
  }

  function handleRemovePhoto(id: string) {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <section className="screen screen--sticky-footer">
      <PageHeader
        backTo="/reports"
        backLabel="Reports"
        title="Log a rescue report"
        subtitle="Record incoming emergency and dispatch rescue team."
      />

      <form onSubmit={handleSubmit} className="stack" style={{ gap: '1.25rem' }}>
        {/* 1. Animal Category & Species */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p
            className="muted"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '0 0 0.75rem',
            }}
          >
            Animal &amp; Condition
          </p>

          <div className="field">
            <label className="field__label">Species</label>
            <div className="filter-chips" role="group" aria-label="Animal species">
              {SPECIES_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`chip${speciesPreset === item ? ' chip--active' : ''}`}
                  aria-pressed={speciesPreset === item}
                  onClick={() => setSpeciesPreset(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {speciesPreset === 'Other' ? (
            <div style={{ marginTop: '0.75rem' }}>
              <TextField
                label="Custom species"
                placeholder="e.g. Goat, Falcon, Rabbit"
                value={speciesOther}
                onChange={(e) => setSpeciesOther(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div style={{ marginTop: '1rem' }}>
            <TextareaField
              label="Chief complaint / Injury"
              placeholder="e.g. Hit by rickshaw • Fractured rear leg & bleeding"
              rows={3}
              value={chiefComplaint}
              onChange={(e) => {
                setChiefComplaint(e.target.value)
                if (error) setError(null)
              }}
              required
            />
          </div>
        </div>

        {/* 2. Photos & Proof (Optional) */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p
            className="muted"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '0 0 0.5rem',
            }}
          >
            Photos &amp; Proof
          </p>
          <p className="muted" style={{ fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
            Optional — take or choose photos from caller or rescue scene
          </p>

          <IntakePhotoPicker
            photos={stagedPhotos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            disabled={submitting}
          />
        </div>

        {/* 3. Location & Landmark */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p
            className="muted"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '0 0 0.75rem',
            }}
          >
            Location Details
          </p>

          <TextField
            label="Location area"
            placeholder="e.g. Burns Road Food Street, Saddar, Karachi"
            value={locationArea}
            onChange={(e) => {
              setLocationArea(e.target.value)
              if (error) setError(null)
            }}
            required
          />

          <div style={{ marginTop: '0.75rem' }}>
            <TextField
              label="Landmark"
              hint="optional"
              placeholder="e.g. Opposite Fresco Sweets Main Corner"
              value={locationLandmark}
              onChange={(e) => setLocationLandmark(e.target.value)}
            />
          </div>
        </div>

        {/* 4. Reporter Details (Confidential / Internal) */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p
            className="muted"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '0 0 0.25rem',
            }}
          >
            Citizen Reporter Info
          </p>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            Confidential &amp; internal to your shelter operations
          </p>

          <TextField
            label="Reporter name"
            hint="optional"
            placeholder="e.g. Usman Ali"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
          />

          <div style={{ marginTop: '0.75rem' }}>
            <TextField
              label="Reporter phone"
              hint="optional"
              type="tel"
              placeholder="e.g. 0300-1234567"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={submitting || !member}
          >
            {submitting ? 'Logging report…' : 'Log rescue report'}
          </Button>
        </div>
      </form>
    </section>
  )
}
