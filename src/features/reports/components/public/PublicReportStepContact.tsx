import { type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Siren, CircleNotch } from '@phosphor-icons/react'
import { validatePhoneNumber, formatPhoneNumber } from '@/features/reports/domain/phone'
import { validateCnic, formatCnic } from '@/features/reports/domain/cnic'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'
import type { PublicPhotoItem } from './PublicReportStepLocation'
import {
  type ReportLanguage,
  type ReportTranslations,
  getReportTranslations,
} from '@/features/reports/domain/reportTranslations'

export type PublicReportStepContactProps = {
  draft: ReportDraftState
  photos: PublicPhotoItem[]
  submitting: boolean
  error: string | null
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onBack: () => void
  onSubmit: (e: FormEvent, honeypotValue: string) => void
  lang?: ReportLanguage
  t?: ReportTranslations
}

export function PublicReportStepContact({
  draft,
  photos,
  submitting,
  error,
  onUpdate,
  onBack,
  onSubmit,
  lang = 'en',
  t = getReportTranslations(lang),
}: PublicReportStepContactProps) {
  const isUrdu = lang === 'ur'
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
        name="fax_number"
        id="report-fax-number"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: 'none', position: 'absolute', left: '-9999px' }}
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
      />

      <div className="public-report__field">
        <label htmlFor="reporter-phone" className="public-report__label">
          {t.phoneLabel}
        </label>
        <input
          id="reporter-phone"
          type="tel"
          dir="ltr"
          className="public-report__input public-report__input--ltr public-report__input--phone"
          placeholder={t.phonePlaceholder}
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
          {t.fullNameLabel}
        </label>
        <input
          id="reporter-name"
          type="text"
          className="public-report__input"
          placeholder={t.fullNamePlaceholder}
          value={draft.reporterName}
          onChange={(e) => onUpdate({ reporterName: e.target.value })}
        />
      </div>

      <div className="public-report__field">
        <label htmlFor="reporter-cnic" className="public-report__label">
          {t.cnicLabel}
        </label>
        <input
          id="reporter-cnic"
          type="text"
          dir="ltr"
          className="public-report__input public-report__input--ltr public-report__input--cnic"
          placeholder={t.cnicPlaceholder}
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
        <span>{t.saveProfileToggle}</span>
      </label>

      {/* Summary card */}
      <div className="public-report__summary">
        <h4 className="public-report__summary-title">{t.reviewSummaryHeading}</h4>
        <div className="public-report__summary-row">
          <span>{t.summaryCategory}</span>
          <strong>
            {draft.category === 'cruelty' ? t.categoryCruelty : t.categorySickInjured}
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>{t.summaryAnimals}</span>
          <strong>
            {draft.speciesPreset === 'Other' ? draft.speciesOther : draft.speciesPreset}
            {draft.avianSubtype ? ` (${draft.avianSubtype})` : ''} · {draft.animalCount}
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>{t.injuryDescriptionLabel}</span>
          <strong>{draft.chiefComplaint}</strong>
        </div>
        <div className="public-report__summary-row">
          <span>{t.summaryLocation}</span>
          <strong>
            {draft.locationArea}, {draft.city}
            {draft.locationLandmark ? ` (${draft.locationLandmark})` : ''}
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>{t.summaryPhotos}</span>
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
          {isUrdu ? (
            <ArrowRight size={18} weight="bold" aria-hidden />
          ) : (
            <ArrowLeft size={18} weight="bold" aria-hidden />
          )}
          <span>{t.back}</span>
        </button>
        <button
          type="submit"
          className={`public-report__btn public-report__btn--primary ${submitting ? 'public-report__btn--loading' : ''}`}
          disabled={submitting || !isPhoneValid || !isCnicValid}
        >
          {submitting ? (
            <>
              <CircleNotch size={20} weight="bold" className="public-report__spin" aria-hidden />
              <span>{t.submittingBtn}</span>
            </>
          ) : (
            <>
              <Siren size={20} weight="bold" aria-hidden />
              <span>{t.submitReportBtn}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
