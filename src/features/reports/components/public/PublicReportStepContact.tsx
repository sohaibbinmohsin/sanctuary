import { type FormEvent, useState } from 'react'
import { ArrowLeft, Check, Siren } from '@phosphor-icons/react'
import { validatePhoneNumber, formatPhoneNumber } from '@/features/reports/domain/phone'
import { validateCnic, formatCnic } from '@/features/reports/domain/cnic'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'
import type { PublicPhotoItem } from './PublicReportStepLocation'

export type PublicReportStepContactProps = {
  draft: ReportDraftState
  photos: PublicPhotoItem[]
  submitting: boolean
  error: string | null
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onBack: () => void
  onSubmit: (e: FormEvent, honeypotValue: string) => void
}

export function PublicReportStepContact({
  draft,
  photos,
  submitting,
  error,
  onUpdate,
  onBack,
  onSubmit,
}: PublicReportStepContactProps) {
  const [honeypot, setHoneypot] = useState('')
  const phoneValidation = validatePhoneNumber(draft.reporterPhone)
  const cnicValidation = validateCnic(draft.reporterCnic)

  const isPhoneValid = draft.reporterPhone.trim().length > 0 && phoneValidation.isValid
  const isCnicValid = !draft.reporterCnic.trim() || cnicValidation.isValid

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isPhoneValid || !isCnicValid) return
    onSubmit(e, honeypot)
  }

  return (
    <form onSubmit={handleFormSubmit} className="public-report__step-form">
      {/* Honeypot trap for automated bots */}
      <input
        type="text"
        name="sanctuary_security_trap"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: 'none', position: 'absolute', left: '-9999px' }}
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
      />

      <div className="public-report__field">
        <label htmlFor="reporter-phone" className="public-report__label">
          Mobile phone number
        </label>
        <input
          id="reporter-phone"
          type="tel"
          className="public-report__input"
          placeholder="0300 1234567"
          value={draft.reporterPhone}
          onChange={(e) => onUpdate({ reporterPhone: formatPhoneNumber(e.target.value) })}
          required
        />
        {draft.reporterPhone.trim() ? (
          phoneValidation.isValid ? (
            <span className="public-report__valid-hint">
              <Check size={14} weight="bold" /> Valid mobile number
            </span>
          ) : (
            <span className="public-report__error">{phoneValidation.error}</span>
          )
        ) : null}
      </div>

      <div className="public-report__field">
        <label htmlFor="reporter-name" className="public-report__label">
          Your name (optional)
        </label>
        <input
          id="reporter-name"
          type="text"
          className="public-report__input"
          placeholder="e.g. Usman Ali"
          value={draft.reporterName}
          onChange={(e) => onUpdate({ reporterName: e.target.value })}
        />
      </div>

      <div className="public-report__field">
        <label htmlFor="reporter-cnic" className="public-report__label">
          CNIC (optional)
        </label>
        <input
          id="reporter-cnic"
          type="text"
          className="public-report__input"
          placeholder="42101-1234567-1"
          value={draft.reporterCnic}
          onChange={(e) => onUpdate({ reporterCnic: formatCnic(e.target.value) })}
        />
        {draft.reporterCnic.trim() ? (
          cnicValidation.isValid ? (
            <span className="public-report__valid-hint">
              <Check size={14} weight="bold" /> Valid CNIC
            </span>
          ) : (
            <span className="public-report__error">{cnicValidation.error}</span>
          )
        ) : null}
      </div>

      <label className="public-report__checkbox-label">
        <input
          type="checkbox"
          checked={draft.rememberProfile}
          onChange={(e) => onUpdate({ rememberProfile: e.target.checked })}
        />
        <span>Remember my contact details on this device for future rescue reports</span>
      </label>

      {/* Summary card */}
      <div className="public-report__summary">
        <h4 className="public-report__summary-title">Report Summary</h4>
        <div className="public-report__summary-row">
          <span>Animal</span>
          <strong>
            {draft.speciesPreset === 'Other' ? draft.speciesOther : draft.speciesPreset}
            {draft.avianSubtype ? ` (${draft.avianSubtype})` : ''} · {draft.animalCount} in care
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>Complaint</span>
          <strong>{draft.chiefComplaint}</strong>
        </div>
        <div className="public-report__summary-row">
          <span>Location</span>
          <strong>
            {draft.locationArea}, {draft.city}
            {draft.locationLandmark ? ` (${draft.locationLandmark})` : ''}
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>Photos</span>
          <strong>{photos.length} attached</strong>
        </div>
      </div>

      {error ? <p className="public-report__error-banner">{error}</p> : null}

      <div className="public-report__actions public-report__actions--split">
        <button
          type="button"
          className="public-report__btn public-report__btn--secondary"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
          Back
        </button>
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={submitting || !isPhoneValid || !isCnicValid}
        >
          <Siren size={20} weight="bold" aria-hidden />
          {submitting ? 'Submitting report...' : 'Submit Emergency Report'}
        </button>
      </div>
    </form>
  )
}
