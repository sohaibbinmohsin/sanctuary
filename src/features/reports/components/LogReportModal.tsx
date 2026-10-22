import { useState, type FormEvent } from 'react'
import { Check } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/Field'
import {
  createRescueReport,
  generateReportNumber,
  formatPhoneNumber,
  validatePhoneNumber,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'

export type LogReportModalProps = {
  isOpen: boolean
  onClose: () => void
  orgId: string
  orgInitials: string
  onReportCreated?: (report: RescueReport) => void
}

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Donkey', 'Horse', 'Bird', 'Other'] as const

export function LogReportModal({
  isOpen,
  onClose,
  orgId,
  orgInitials,
  onReportCreated,
}: LogReportModalProps) {
  const db = useDb()
  const [species, setSpecies] = useState<string>('Dog')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [locationArea, setLocationArea] = useState('')
  const [locationLandmark, setLocationLandmark] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db) {
      setError('Database is not initialized.')
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

    const phoneValidation = validatePhoneNumber(reporterPhone)
    if (reporterPhone.trim() && !phoneValidation.isValid) {
      setError(phoneValidation.error || 'Please enter a valid phone number (e.g. 0300-1234567).')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const reportNumber = await generateReportNumber(db, orgInitials || 'SANCTUARY')
      const report = await createRescueReport(db, {
        orgId,
        reportNumber,
        species: species.toLowerCase(),
        chiefComplaint: complaintTrimmed,
        locationArea: areaTrimmed,
        locationLandmark: locationLandmark.trim() || null,
        reporterName: reporterName.trim() || null,
        reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
      })

      // Reset form fields
      setSpecies('Dog')
      setChiefComplaint('')
      setLocationArea('')
      setLocationLandmark('')
      setReporterName('')
      setReporterPhone('')

      onReportCreated?.(report)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rescue report.')
    } finally {
      setSubmitting(false)
    }
  }

  const phoneValidation = validatePhoneNumber(reporterPhone)

  return (
    <ResponsiveSheetModal isOpen={isOpen} onClose={onClose} title="Log incoming rescue report">
      <form onSubmit={handleSubmit} className="stack log-report-form">
        <div className="field">
          <label className="field__label">Animal species</label>
          <div className="filter-chips" role="group" aria-label="Animal species">
            {SPECIES_OPTIONS.map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${species.toLowerCase() === item.toLowerCase() ? ' chip--active' : ''}`}
                aria-pressed={species.toLowerCase() === item.toLowerCase()}
                onClick={() => setSpecies(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <TextField
          label="Chief complaint / Injury"
          placeholder="e.g. Hit by rickshaw • Fractured rear leg & bleeding"
          value={chiefComplaint}
          onChange={(e) => {
            setChiefComplaint(e.target.value)
            if (error) setError(null)
          }}
          required
        />

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
          hint="Optional"
          placeholder="e.g. Opposite Fresco Sweets Main Corner"
          value={locationLandmark}
          onChange={(e) => setLocationLandmark(e.target.value)}
        />

        <TextField
          label="Reporter name"
          hint="Confidential"
          placeholder="e.g. Usman Ali"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
        />

        <div className="field stack stack--tight">
          <TextField
            label="Reporter phone"
            hint="Confidential"
            type="tel"
            placeholder="e.g. 0300-1234567"
            value={reporterPhone}
            onChange={(e) => {
              setReporterPhone(formatPhoneNumber(e.target.value))
              if (error) setError(null)
            }}
          />
          {reporterPhone.trim() ? (
            phoneValidation.isValid ? (
              <span
                className="field__hint"
                style={{
                  color: 'var(--color-forest)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <Check size={14} weight="bold" /> Valid phone number
              </span>
            ) : (
              <span
                className="field__hint"
                style={{ color: 'var(--color-amber)', fontWeight: 500 }}
              >
                {phoneValidation.error}
              </span>
            )
          ) : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="responsive-modal__actions">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving report…' : 'Log rescue report'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </ResponsiveSheetModal>
  )
}
