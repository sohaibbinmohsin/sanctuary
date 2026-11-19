import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import './AgeWheelSheet.css'

const YEARS = Array.from({ length: 21 }, (_, n) => n)
const MONTHS = Array.from({ length: 12 }, (_, n) => n)

export type AgeWheelValue = { years: number; months: number }

type AgeWheelSheetProps = {
  open: boolean
  years: number
  months: number
  onCancel: () => void
  onDone: (value: AgeWheelValue) => void
}

export function AgeWheelSheet({ open, years, months, onCancel, onDone }: AgeWheelSheetProps) {
  const [draftYears, setDraftYears] = useState(years)
  const [draftMonths, setDraftMonths] = useState(months)

  useEffect(() => {
    if (!open) return
    setDraftYears(years)
    setDraftMonths(months)
  }, [open, years, months])

  return (
    <ResponsiveSheetModal isOpen={open} onClose={onCancel} title="Age">
      <div className="age-wheels">
        <div className="age-wheels__col" role="listbox" aria-label="Years">
          {YEARS.map((year) => (
            <button
              key={year}
              type="button"
              role="option"
              className="age-wheels__option"
              aria-selected={draftYears === year}
              onClick={() => setDraftYears(year)}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="age-wheels__col" role="listbox" aria-label="Months">
          {MONTHS.map((month) => (
            <button
              key={month}
              type="button"
              role="option"
              className="age-wheels__option"
              aria-selected={draftMonths === month}
              onClick={() => setDraftMonths(month)}
            >
              {month}
            </button>
          ))}
        </div>
      </div>
      <div className="responsive-modal__actions">
        <Button type="button" variant="primary" onClick={() => onDone({ years: draftYears, months: draftMonths })}>
          Done
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </ResponsiveSheetModal>
  )
}