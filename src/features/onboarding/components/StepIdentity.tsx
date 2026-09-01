import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { UploadSimple } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { orgInitials } from '@/shared/lib/ids/orgInitials'

export type StepIdentityProps = {
  name: string
  initials: string
  logoFile: File | null
  onNameChange: (name: string) => void
  onInitialsChange: (initials: string) => void
  onLogoFileChange: (file: File | null) => void
  onNext: () => void
}

export function StepIdentity({
  name,
  initials,
  logoFile,
  onNameChange,
  onInitialsChange,
  onLogoFileChange,
  onNext,
}: StepIdentityProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [logoFile])

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      onLogoFileChange(file)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onLogoFileChange(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) {
      onNext()
    }
  }

  const isContinueDisabled = !name.trim()

  return (
    <form className="onboarding-step stack" onSubmit={handleSubmit}>
      <div className="onboarding-step__header">
        <h2>Shelter identity</h2>
        <p className="muted">
          Enter your shelter name and animal code prefix. You can also upload a logo now or customize it later in Settings.
        </p>
      </div>

      <div className="stack" style={{ gap: '1.25rem' }}>
        <Field label="Shelter name" hint="Required" htmlFor="onboarding-shelter-name">
          <input
            id="onboarding-shelter-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Safe Haven Sanctuary"
            autoFocus
          />
        </Field>

        <Field
          label="Shelter code initials"
          hint="Used for animal IDs like LAS-001"
          htmlFor="onboarding-shelter-initials"
        >
          <input
            id="onboarding-shelter-initials"
            type="text"
            value={initials}
            onChange={(e) => onInitialsChange(e.target.value)}
            placeholder={orgInitials(name) || 'e.g. SHS'}
            maxLength={10}
          />
        </Field>

        <div className="stack" style={{ gap: '0.5rem' }}>
          <label className="field__label" htmlFor="onboarding-logo-file">
            Shelter logo <span className="field__hint">· Optional</span>
          </label>
          <input
            ref={fileInputRef}
            id="onboarding-logo-file"
            type="file"
            accept="image/*"
            data-testid="logo-file-input"
            onChange={handleFileSelect}
            hidden
          />
          {previewUrl ? (
            <div className="onboarding-logo-card">
              <img
                src={previewUrl}
                alt="Shelter logo preview"
                className="onboarding-logo-preview"
              />
              <div className="row" style={{ gap: '0.75rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace logo
                </Button>
                <Button
                  type="button"
                  variant="danger-ghost"
                  onClick={() => onLogoFileChange(null)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={[
                'onboarding-dropzone',
                isDragging ? 'onboarding-dropzone--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <UploadSimple size={28} className="onboarding-dropzone__icon" aria-hidden />
              <div className="onboarding-dropzone__text">
                <span className="onboarding-dropzone__title">
                  Click or drag image to upload logo
                </span>
                <span className="muted onboarding-dropzone__hint">
                  PNG, JPG, SVG, or WebP
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="onboarding-step__actions">
        <Button
          type="submit"
          variant="primary"
          block
          disabled={isContinueDisabled}
        >
          Continue to animal statuses →
        </Button>
      </div>
    </form>
  )
}
