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
  AVIAN_PRESETS,
  type IntakeSource,
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

const INTAKE_SOURCES: { value: IntakeSource; label: string }[] = [
  { value: 'citizen', label: 'Citizen Call' },
  { value: 'rescue_1122', label: 'Rescue 1122' },
  { value: 'field_patrol', label: 'Field Patrol (Self)' },
  { value: 'partner_transfer', label: 'Partner Transfer' },
]

export function LogReportModal({
  isOpen,
  onClose,
  orgId,
  orgInitials,
  onReportCreated,
}: LogReportModalProps) {
  const db = useDb()
  const [intakeCountMode, setIntakeCountMode] = useState<'single' | 'litter' | 'multiple'>('single')
  const [litterComposition, setLitterComposition] = useState<'offspring_only' | 'mother_and_offspring'>('offspring_only')
  const [species, setSpecies] = useState<string>('Dog')
  const [avianSubtype, setAvianSubtype] = useState<string>('')
  const [animalCount, setAnimalCount] = useState<number>(1)
  const [intakeSource, setIntakeSource] = useState<IntakeSource>('citizen')
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
      setError(phoneValidation.error || 'Please enter a valid phone number (e.g. 0300 1234567).')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      let effectiveCount = 1
      let effectiveSpecies =
        species.toLowerCase() === 'bird'
          ? avianSubtype ? avianSubtype.toLowerCase() : 'bird'
          : species.toLowerCase()
      let effectiveLifeStage: 'adult' | 'child' | null = 'adult'
      let groupBreakdownJson: string | null = null

      if (intakeCountMode === 'single') {
        effectiveCount = 1
        effectiveLifeStage = 'adult'
        groupBreakdownJson = null
      } else if (intakeCountMode === 'litter') {
        effectiveCount = Math.max(2, animalCount)
        if (litterComposition === 'mother_and_offspring') {
          effectiveLifeStage = 'adult'
          groupBreakdownJson = JSON.stringify([
            { id: 'mother', count: 1, species: effectiveSpecies, lifeStage: 'adult' },
            {
              id: 'litter',
              count: Math.max(1, effectiveCount - 1),
              species: effectiveSpecies,
              lifeStage: 'child',
            },
          ])
        } else {
          effectiveLifeStage = 'child'
          groupBreakdownJson = JSON.stringify([
            { id: 'litter', count: effectiveCount, species: effectiveSpecies, lifeStage: 'child' },
          ])
        }
      } else if (intakeCountMode === 'multiple') {
        effectiveCount = Math.max(2, animalCount)
        effectiveLifeStage = null
        groupBreakdownJson = JSON.stringify([
          { id: 'group', count: effectiveCount, species: effectiveSpecies, lifeStage: null },
        ])
      }

      const reportNumber = await generateReportNumber(db, orgInitials || 'SANCTUARY')
      const report = await createRescueReport(db, {
        orgId,
        reportNumber,
        species: effectiveSpecies,
        lifeStage: effectiveLifeStage,
        chiefComplaint: complaintTrimmed,
        locationArea: areaTrimmed,
        locationLandmark: locationLandmark.trim() || null,
        reporterName: reporterName.trim() || null,
        reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
        intakeSource,
        animalCount: Math.max(1, effectiveCount),
        groupBreakdown: groupBreakdownJson,
      })

      // Reset form fields
      setIntakeCountMode('single')
      setLitterComposition('offspring_only')
      setSpecies('Dog')
      setAvianSubtype('')
      setAnimalCount(1)
      setIntakeSource('citizen')
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
          <label className="field__label">Intake source</label>
          <div className="filter-chips" role="group" aria-label="Intake source">
            {INTAKE_SOURCES.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`chip${intakeSource === item.value ? ' chip--active' : ''}`}
                aria-pressed={intakeSource === item.value}
                onClick={() => setIntakeSource(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Animal Count & Composition Mode - Appears BEFORE Species */}
        <div className="field">
          <label className="field__label">Animal count &amp; composition</label>
          <div className="filter-chips" role="group" aria-label="Animal count mode">
            <button
              type="button"
              className={`chip${intakeCountMode === 'single' ? ' chip--active' : ''}`}
              aria-pressed={intakeCountMode === 'single'}
              onClick={() => {
                setIntakeCountMode('single')
                setAnimalCount(1)
              }}
            >
              Single Animal
            </button>
            <button
              type="button"
              className={`chip${intakeCountMode === 'litter' ? ' chip--active' : ''}`}
              aria-pressed={intakeCountMode === 'litter'}
              onClick={() => {
                setIntakeCountMode('litter')
                if (animalCount <= 1) setAnimalCount(4)
              }}
            >
              Litter / Family
            </button>
            <button
              type="button"
              className={`chip${intakeCountMode === 'multiple' ? ' chip--active' : ''}`}
              aria-pressed={intakeCountMode === 'multiple'}
              onClick={() => {
                setIntakeCountMode('multiple')
                if (animalCount <= 1) setAnimalCount(3)
              }}
            >
              Multiple Animals
            </button>
          </div>
        </div>

        {/* If Litter or Multiple: Stepper */}
        {intakeCountMode !== 'single' ? (
          <div className="field stack stack--tight">
            <label className="field__label" htmlFor="modal-animal-count">
              {intakeCountMode === 'litter' ? 'Total in litter' : 'Total animals in group'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="segmented__btn"
                style={{ width: '36px', height: '36px', padding: 0, fontSize: '18px', fontWeight: 'bold' }}
                onClick={() => setAnimalCount((prev) => Math.max(2, prev - 1))}
                disabled={animalCount <= 2}
                aria-label="Decrease count"
              >
                -
              </button>
              <input
                id="modal-animal-count"
                aria-label="Animal count"
                type="number"
                inputMode="numeric"
                className="input-no-spinner"
                min={2}
                max={50}
                value={animalCount < 2 ? (intakeCountMode === 'litter' ? 4 : 3) : animalCount}
                onChange={(e) => setAnimalCount(Math.max(2, parseInt(e.target.value, 10) || 2))}
                style={{
                  width: '60px',
                  textAlign: 'center',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                type="button"
                className="segmented__btn"
                style={{ width: '36px', height: '36px', padding: 0, fontSize: '18px', fontWeight: 'bold' }}
                onClick={() => setAnimalCount((prev) => prev + 1)}
                aria-label="Increase count"
              >
                +
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-brand, #de6b2b)' }}>
                {intakeCountMode === 'litter'
                  ? `Litter of ${animalCount < 2 ? 4 : animalCount}`
                  : `Group of ${animalCount < 2 ? 3 : animalCount}`}
              </span>
            </div>
          </div>
        ) : null}

        {/* If Litter: Composition toggle */}
        {intakeCountMode === 'litter' ? (
          <div className="field stack stack--tight">
            <label className="field__label">Litter Composition</label>
            <div className="filter-chips" role="group" aria-label="Litter composition">
              <button
                type="button"
                className={`chip${litterComposition === 'offspring_only' ? ' chip--active' : ''}`}
                aria-pressed={litterComposition === 'offspring_only'}
                onClick={() => setLitterComposition('offspring_only')}
              >
                Babies only
              </button>
              <button
                type="button"
                className={`chip${litterComposition === 'mother_and_offspring' ? ' chip--active' : ''}`}
                aria-pressed={litterComposition === 'mother_and_offspring'}
                onClick={() => setLitterComposition('mother_and_offspring')}
              >
                Mother + {Math.max(1, (animalCount < 2 ? 4 : animalCount) - 1)} Babies
              </button>
            </div>
          </div>
        ) : null}

        <div className="field">
          <label className="field__label">Animal species</label>
          <div className="filter-chips" role="group" aria-label="Animal species">
            {SPECIES_OPTIONS.map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${species.toLowerCase() === item.toLowerCase() ? ' chip--active' : ''}`}
                aria-pressed={species.toLowerCase() === item.toLowerCase()}
                onClick={() => {
                  setSpecies(item)
                  if (item !== 'Bird') setAvianSubtype('')
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {species.toLowerCase() === 'bird' ? (
          <div className="field">
            <label className="field__label">Avian sub-type</label>
            <div className="filter-chips" role="group" aria-label="Avian sub-type">
              {AVIAN_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`chip${avianSubtype === item ? ' chip--active' : ''}`}
                  aria-pressed={avianSubtype === item}
                  onClick={() => setAvianSubtype(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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

        <div className="field stack stack--tight">
          <TextField
            label={
              intakeSource === 'rescue_1122'
                ? 'Contact Phone'
                : intakeSource === 'field_patrol'
                  ? 'Rescuer Contact Phone'
                  : intakeSource === 'partner_transfer'
                    ? 'Partner Contact Phone'
                    : 'Reporter phone'
            }
            hint={intakeSource === 'citizen' ? 'Confidential' : 'Optional'}
            type="tel"
            placeholder={
              intakeSource === 'rescue_1122'
                ? 'e.g. 042 99231122 or mobile'
                : 'e.g. 0300 1234567'
            }
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

        <TextField
          label={
            intakeSource === 'rescue_1122'
              ? 'Dispatcher / Officer Name'
              : intakeSource === 'field_patrol'
                ? 'Rescuer / Team Member Name'
                : intakeSource === 'partner_transfer'
                  ? 'Referring Partner / Shelter'
                  : 'Reporter name'
          }
          hint="Optional"
          placeholder={
            intakeSource === 'rescue_1122'
              ? 'e.g. Tariq / Control Room'
              : intakeSource === 'field_patrol'
                ? 'e.g. Ameer Hamza / Tahira Zafar'
                : intakeSource === 'partner_transfer'
                  ? "e.g. Todd's Welfare Society (TWS)"
                  : 'e.g. Usman Ali'
          }
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
        />

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
