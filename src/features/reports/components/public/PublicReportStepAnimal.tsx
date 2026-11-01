import { type FormEvent } from 'react'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { AVIAN_PRESETS } from '@/features/reports/domain/rescueReports'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'
import {
  type ReportLanguage,
  type ReportTranslations,
  getReportTranslations,
  EMERGENCY_QUICK_COMPLAINTS_EN,
  EMERGENCY_QUICK_COMPLAINTS_UR,
  CRUELTY_QUICK_COMPLAINTS_EN,
  CRUELTY_QUICK_COMPLAINTS_UR,
} from '@/features/reports/domain/reportTranslations'

export const SPECIES_OPTIONS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other'] as const

export const QUICK_COMPLAINTS = EMERGENCY_QUICK_COMPLAINTS_EN

export type PublicReportStepAnimalProps = {
  draft: ReportDraftState
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onNext: () => void
  lang?: ReportLanguage
  t?: ReportTranslations
}

export function PublicReportStepAnimal({
  draft,
  onUpdate,
  onNext,
  lang = 'en',
  t = getReportTranslations(lang),
}: PublicReportStepAnimalProps) {
  const isCruelty = draft.category === 'cruelty'
  const isUrdu = lang === 'ur'
  const activeQuickTags = isCruelty
    ? isUrdu
      ? CRUELTY_QUICK_COMPLAINTS_UR
      : CRUELTY_QUICK_COMPLAINTS_EN
    : isUrdu
      ? EMERGENCY_QUICK_COMPLAINTS_UR
      : EMERGENCY_QUICK_COMPLAINTS_EN

  function handleQuickComplaint(tag: string) {
    if (!draft.chiefComplaint.trim()) {
      onUpdate({ chiefComplaint: tag })
    } else if (!draft.chiefComplaint.includes(tag)) {
      onUpdate({ chiefComplaint: `${draft.chiefComplaint.trim()}, ${tag}` })
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.chiefComplaint.trim()) return
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="public-report__step-form">
      <div className="public-report__group">
        <label className="public-report__label">{t.reportCategoryLabel}</label>
        <div className="public-report__chips" role="group" aria-label="Report category">
          <button
            type="button"
            className={`public-report__chip${draft.category === 'emergency' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.category === 'emergency'}
            onClick={() => onUpdate({ category: 'emergency' })}
          >
            {t.medicalEmergency}
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.category === 'cruelty' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.category === 'cruelty'}
            onClick={() => onUpdate({ category: 'cruelty' })}
          >
            {t.animalCruelty}
          </button>
        </div>
      </div>

      <div className="public-report__group">
        <label className="public-report__label">{t.howManyAnimals}</label>
        <div className="public-report__chips" role="group" aria-label="Animal composition">
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'single' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'single'}
            onClick={() => onUpdate({ intakeCountMode: 'single', animalCount: 1 })}
          >
            {t.singleAnimal}
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'litter' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'litter'}
            onClick={() => onUpdate({ intakeCountMode: 'litter', animalCount: Math.max(2, draft.animalCount) })}
          >
            {t.litter}
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'multiple' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'multiple'}
            onClick={() => onUpdate({ intakeCountMode: 'multiple', animalCount: Math.max(2, draft.animalCount) })}
          >
            {t.multipleAnimals}
          </button>
        </div>
      </div>

      {draft.intakeCountMode === 'litter' ? (
        <>
          <div className="public-report__group">
            <label className="public-report__label" htmlFor="animal-count">
              {t.numberOfAnimals}
            </label>
            <div className="public-report__stepper">
              <button
                type="button"
                className="public-report__step-btn"
                onClick={() => onUpdate({ animalCount: Math.max(2, draft.animalCount - 1) })}
                disabled={draft.animalCount <= 2}
                aria-label="Decrease count"
              >
                -
              </button>
              <span className="public-report__step-count">{draft.animalCount}</span>
              <button
                type="button"
                className="public-report__step-btn"
                onClick={() => onUpdate({ animalCount: draft.animalCount + 1 })}
                aria-label="Increase count"
              >
                +
              </button>
              <span className="public-report__valid-hint" style={{ marginLeft: 'var(--space-2)' }}>
                {lang === 'ur' ? `${draft.animalCount} بچے` : `Litter of ${draft.animalCount}`}
              </span>
            </div>
          </div>

          <div className="public-report__group">
            <label className="public-report__label">Litter composition</label>
            <div className="public-report__chips" role="group" aria-label="Litter composition">
              <button
                type="button"
                className={`public-report__chip${draft.litterComposition === 'offspring_only' ? ' public-report__chip--active' : ''}`}
                aria-pressed={draft.litterComposition === 'offspring_only'}
                onClick={() => onUpdate({ litterComposition: 'offspring_only' })}
              >
                Babies only
              </button>
              <button
                type="button"
                className={`public-report__chip${draft.litterComposition === 'mother_and_offspring' ? ' public-report__chip--active' : ''}`}
                aria-pressed={draft.litterComposition === 'mother_and_offspring'}
                onClick={() => onUpdate({ litterComposition: 'mother_and_offspring' })}
              >
                Mother + {Math.max(1, draft.animalCount - 1)} Babies
              </button>
            </div>
          </div>
        </>
      ) : null}

      {draft.intakeCountMode === 'multiple' ? (
        <div className="public-report__group">
          <label className="public-report__label" htmlFor="animal-count">
            {t.numberOfAnimals}
          </label>
          <div className="public-report__stepper">
            <button
              type="button"
              className="public-report__step-btn"
              onClick={() => onUpdate({ animalCount: Math.max(2, draft.animalCount - 1) })}
              disabled={draft.animalCount <= 2}
              aria-label="Decrease count"
            >
              -
            </button>
            <span className="public-report__step-count">{draft.animalCount}</span>
            <button
              type="button"
              className="public-report__step-btn"
              onClick={() => onUpdate({ animalCount: draft.animalCount + 1 })}
              aria-label="Increase count"
            >
              +
            </button>
            <span className="public-report__valid-hint" style={{ marginLeft: 'var(--space-2)' }}>
              {lang === 'ur' ? `${draft.animalCount} جانور` : `Group of ${draft.animalCount}`}
            </span>
          </div>
        </div>
      ) : null}

      {draft.intakeCountMode === 'single' ? (
        <div className="public-report__group">
          <label className="public-report__label">{t.lifeStage}</label>
          <div className="public-report__chips" role="group" aria-label="Life stage">
            <button
              type="button"
              className={`public-report__chip${draft.lifeStage === 'adult' ? ' public-report__chip--active' : ''}`}
              aria-pressed={draft.lifeStage === 'adult'}
              onClick={() => onUpdate({ lifeStage: 'adult' })}
            >
              {t.adult}
            </button>
            <button
              type="button"
              className={`public-report__chip${draft.lifeStage === 'child' ? ' public-report__chip--active' : ''}`}
              aria-pressed={draft.lifeStage === 'child'}
              onClick={() => onUpdate({ lifeStage: 'child' })}
            >
              {t.puppyKitten}
            </button>
          </div>
        </div>
      ) : null}

      <div className="public-report__group">
        <label className="public-report__label">{t.species}</label>
        <div className="public-report__chips" role="group" aria-label="Animal type">
          {SPECIES_OPTIONS.map((item) => {
            const speciesLabelMap: Record<string, string> = {
              Dog: t.speciesDog,
              Cat: t.speciesCat,
              Horse: t.speciesHorse,
              Donkey: t.speciesDonkey,
              Bird: t.speciesBird,
              Other: t.speciesOther,
            }
            return (
              <button
                type="button"
                key={item}
                className={`public-report__chip${draft.speciesPreset === item ? ' public-report__chip--active' : ''}`}
                aria-pressed={draft.speciesPreset === item}
                onClick={() => onUpdate({ speciesPreset: item, avianSubtype: '' })}
              >
                {speciesLabelMap[item] || item}
              </button>
            )
          })}
        </div>
      </div>

      {draft.speciesPreset === 'Bird' ? (
        <div className="public-report__group">
          <label className="public-report__label">{t.avianSpecies}</label>
          <div className="public-report__chips" role="group" aria-label="Avian species">
            {AVIAN_PRESETS.map((item) => (
              <button
                type="button"
                key={item}
                className={`public-report__chip${draft.avianSubtype === item ? ' public-report__chip--active' : ''}`}
                aria-pressed={draft.avianSubtype === item}
                onClick={() => onUpdate({ avianSubtype: item })}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft.speciesPreset === 'Other' ? (
        <div className="public-report__field">
          <label htmlFor="species-other" className="public-report__label">
            {t.specifyAnimal}
          </label>
          <input
            id="species-other"
            type="text"
            className="public-report__input"
            placeholder="e.g. Goat, Falcon, Rabbit"
            value={draft.speciesOther}
            onChange={(e) => onUpdate({ speciesOther: e.target.value })}
            required
          />
        </div>
      ) : null}

      <div className="public-report__field">
        <label htmlFor="chief-complaint" className="public-report__label">
          {isCruelty ? t.crueltyDescriptionLabel : t.injuryDescriptionLabel}
        </label>
        <div className="public-report__quick-tags" aria-label="Quick complaint tags">
          {activeQuickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="public-report__quick-tag"
              onClick={() => handleQuickComplaint(tag)}
            >
              + {tag}
            </button>
          ))}
        </div>
        <textarea
          id="chief-complaint"
          className="public-report__textarea"
          rows={3}
          placeholder={isCruelty ? t.crueltyPlaceholder : t.injuryPlaceholder}
          value={draft.chiefComplaint}
          onChange={(e) => onUpdate({ chiefComplaint: e.target.value })}
          required
        />
      </div>

      <div className="public-report__actions">
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={!draft.chiefComplaint.trim()}
        >
          <span>{t.nextLocation}</span>
          {isUrdu ? (
            <ArrowLeft size={18} weight="bold" aria-hidden />
          ) : (
            <ArrowRight size={18} weight="bold" aria-hidden />
          )}
        </button>
      </div>
    </form>
  )
}
