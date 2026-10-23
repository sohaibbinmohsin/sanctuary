import { useState, type FormEvent, useEffect } from 'react'
import { Siren, X, CheckCircle } from '@phosphor-icons/react'
import './reportCaseModal.css'

type ReportCaseModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function ReportCaseModal({ isOpen, onClose }: ReportCaseModalProps) {
  const [animal, setAnimal] = useState('')
  const [urgency, setUrgency] = useState('Critical')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false)
      setAnimal('')
      setLocation('')
      setPhone('')
      setDetails('')
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div
      className="report-modal__overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="report-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Report case"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="report-modal__header">
          <div className="report-modal__title-group">
            <span className="report-modal__icon-badge" aria-hidden="true">
              <Siren size={22} weight="bold" />
            </span>
            <div>
              <h2 id="report-modal-title" className="report-modal__title">
                Report an animal in distress
              </h2>
              <p className="report-modal__subtitle">
                Reports are directly dispatched to partner rescue networks in your area.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="report-modal__close"
            onClick={onClose}
            aria-label="Close report dialog"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {submitted ? (
          <div className="report-modal__success">
            <CheckCircle
              className="report-modal__success-icon"
              size={56}
              weight="duotone"
              aria-hidden="true"
            />
            <h3 className="report-modal__title">Report submitted</h3>
            <p className="report-modal__subtitle">
              Routed to partner rescue networks in your area. Responders will contact you if additional directions are needed.
            </p>
            <button
              type="button"
              className="report-modal__btn report-modal__btn--secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal__form">
            <div className="report-modal__field">
              <label htmlFor="report-animal" className="report-modal__label">
                Animal and condition
              </label>
              <input
                id="report-animal"
                type="text"
                className="report-modal__input"
                placeholder="e.g. Injured stray dog, trapped kitten"
                value={animal}
                onChange={(e) => setAnimal(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-urgency" className="report-modal__label">
                Urgency level
              </label>
              <select
                id="report-urgency"
                className="report-modal__select"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="Critical">Critical (Bleeding, hit-and-run, unconscious)</option>
                <option value="Urgent">Urgent (Severe injury, unable to stand)</option>
                <option value="Standard">Standard (Sick, malnourished, trapped)</option>
              </select>
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-location" className="report-modal__label">
                Location and landmark
              </label>
              <input
                id="report-location"
                type="text"
                className="report-modal__input"
                placeholder="e.g. Near Kalma Chowk underpass, Lahore"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-phone" className="report-modal__label">
                Contact phone number
              </label>
              <input
                id="report-phone"
                type="tel"
                className="report-modal__input"
                placeholder="03XX XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-details" className="report-modal__label">
                Additional notes (optional)
              </label>
              <textarea
                id="report-details"
                className="report-modal__textarea"
                rows={2}
                placeholder="Exact spot, animal behavior, nearby landmarks"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="report-modal__actions">
              <button
                type="button"
                className="report-modal__btn report-modal__btn--secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="report-modal__btn report-modal__btn--primary"
              >
                Submit report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
