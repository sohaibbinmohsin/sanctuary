import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CaretDown, FileText } from '@phosphor-icons/react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { stageIntakePhotos } from '@/features/animals/domain/intakePhotoStore'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import './AddAnimalSplitButton.css'

export function AddAnimalSplitButton() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!isOpen || isMobile) return
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isMobile])

  function handlePrimaryClick() {
    if (isMobile) {
      // Mobile: directly open camera and come back to form
      fileInputRef.current?.click()
    } else {
      // Desktop: directly open form
      navigate('/animals/new')
    }
  }

  function handleToggleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setIsOpen((prev) => !prev)
  }

  function handleCameraSelect() {
    setIsOpen(false)
    fileInputRef.current?.click()
  }

  function handleFormSelect() {
    setIsOpen(false)
    navigate('/animals/new')
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      stageIntakePhotos(files, 'camera')
      navigate('/animals/new', {
        state: { initialPhoto: files[0] },
      })
    }
    e.target.value = ''
  }

  return (
    <div className="add-animal-split-button" ref={containerRef}>
      <button
        type="button"
        className="btn btn--accent add-animal-split-button__action"
        onClick={handlePrimaryClick}
      >
        Add animal
      </button>
      <button
        type="button"
        className="btn btn--accent add-animal-split-button__toggle"
        aria-label="Add animal options"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={handleToggleClick}
      >
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>

      {/* Hidden camera input for direct mobile capture and everywhere camera option */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        aria-label="Take animal photo"
        onChange={handleFileChange}
      />

      {/* Desktop dropdown menu (flipped: Form first, Camera second) */}
      {!isMobile && isOpen && (
        <div className="add-animal-dropdown" role="menu">
          <button
            type="button"
            className="add-animal-dropdown-item"
            role="menuitem"
            onClick={handleFormSelect}
          >
            <FileText size={18} weight="bold" aria-hidden />
            <span>Add animal form</span>
          </button>
          <button
            type="button"
            className="add-animal-dropdown-item"
            role="menuitem"
            onClick={handleCameraSelect}
          >
            <Camera size={18} weight="bold" aria-hidden />
            <span>Take photo</span>
          </button>
        </div>
      )}

      {/* Mobile action sheet (two options: Camera first, Form second) */}
      {isMobile && (
        <ResponsiveSheetModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Add animal"
        >
          <div className="add-animal-sheet-list">
            <button
              type="button"
              className="add-animal-sheet-option"
              onClick={handleCameraSelect}
            >
              <div className="add-animal-sheet-option__icon">
                <Camera size={24} weight="duotone" aria-hidden />
              </div>
              <div className="add-animal-sheet-option__text">
                <span className="add-animal-sheet-option__label">Take photo</span>
                <span className="add-animal-sheet-option__desc">
                  Open camera, then enter details
                </span>
              </div>
            </button>
            <button
              type="button"
              className="add-animal-sheet-option"
              onClick={handleFormSelect}
            >
              <div className="add-animal-sheet-option__icon">
                <FileText size={24} weight="duotone" aria-hidden />
              </div>
              <div className="add-animal-sheet-option__text">
                <span className="add-animal-sheet-option__label">Add animal form</span>
                <span className="add-animal-sheet-option__desc">
                  Enter details without taking a photo
                </span>
              </div>
            </button>
          </div>
        </ResponsiveSheetModal>
      )}
    </div>
  )
}
