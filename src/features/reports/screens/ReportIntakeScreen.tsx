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

      <form className="stack stack--loose" onSubmit={handleSubmit}>
        {/* 1. Animal Category & Species */}
        <div className="panel stack">
          <p className="section-label">Animal &amp; Condition</p>

          <div className="field">
            <span>Species</span>
            <div className="filter-chips" role="group" aria-label="Animal species">
              {SPECIES_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="chip"
                  aria-pressed={speciesPreset === item}
                  onClick={() => setSpeciesPreset(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {speciesPreset === 'Other' ? (
            <TextField
              label="Custom species"
              placeholder="e.g. Goat, Falcon, Rabbit"
              value={speciesOther}
              onChange={(e) => setSpeciesOther(e.target.value)}
              required
            />
          ) : null}

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

        {/* 2. Photos & Proof (Optional) */}
        <div className="panel stack">
          <div className="stack stack--tight">
            <p className="section-label">Photos &amp; Proof</p>
            <span className="field__hint">Optional — take or choose photos from caller or rescue scene</span>
          </div>

          <IntakePhotoPicker
            photos={stagedPhotos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            disabled={submitting}
          />
        </div>

        {/* 3. Location & Landmark */}
        <div className="panel stack">
          <p className="section-label">Location Details</p>

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

          <TextField
            label="Landmark"
            hint="optional"
            placeholder="e.g. Opposite Fresco Sweets Main Corner"
            value={locationLandmark}
            onChange={(e) => setLocationLandmark(e.target.value)}
          />
        </div>

        {/* 4. Reporter Details (Confidential / Internal) */}
        <div className="panel stack">
          <div className="stack stack--tight">
            <p className="section-label">Citizen Reporter Info</p>
            <span className="field__hint">Confidential &amp; internal to your shelter operations</span>
          </div>

          <TextField
            label="Reporter name"
            hint="optional"
            placeholder="e.g. Usman Ali"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
          />

          <TextField
            label="Reporter phone"
            hint="optional"
            type="tel"
            placeholder="e.g. 0300-1234567"
            value={reporterPhone}
            onChange={(e) => setReporterPhone(e.target.value)}
          />
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
