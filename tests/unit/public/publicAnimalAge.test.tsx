import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimalHighlight } from '@/features/public/components/AnimalHighlight'
import { publicAnimalMetaLine } from '@/shared/lib/public/format'
import type { PublicAnimalDto } from '@/shared/lib/public/visibility'

const animal: PublicAnimalDto = {
  id: 'a1',
  shelterCode: 'AWS-0001',
  name: 'Mona',
  species: 'Cat',
  sex: 'Female',
  markings: null,
  statusLabel: 'Intake',
  ageYears: 0,
  ageMonths: 6,
  photos: [],
  care: [],
}

describe('public animal age', () => {
  it('joins the age phrase into the shelter list meta', () => {
    expect(publicAnimalMetaLine(animal)).toBe('Cat · Female · 6 months · Intake')
    expect(
      publicAnimalMetaLine({ ...animal, ageYears: null, ageMonths: null }),
    ).toBe('Cat · Female · Intake')
  })

  it('shows the age phrase on the highlight and hides sterilized', () => {
    render(
      <AnimalHighlight animal={animal} onClose={vi.fn()} onExplainVerified={vi.fn()} />,
    )
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('6 months')).toBeInTheDocument()
    expect(screen.queryByText('Sterilized')).toBeNull()
  })

  it('omits the age row when age is unknown', () => {
    render(
      <AnimalHighlight
        animal={{ ...animal, ageYears: null, ageMonths: null }}
        onClose={vi.fn()}
        onExplainVerified={vi.fn()}
      />,
    )
    expect(screen.queryByText('Age')).toBeNull()
  })
})