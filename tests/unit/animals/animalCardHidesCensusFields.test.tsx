import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const animal = {
  id: 'a1',
  org_id: 'org-1',
  shelter_code: 'AWS-0001',
  name: 'Mona',
  species: 'Cat',
  sex: 'Female',
  markings: null,
  notes: null,
  archived: 0,
  intake_date: '2026-11-20',
  status_id: 'st-1',
  status_label: 'Intake',
  status_labels: ['Intake'],
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
  age_years: 2,
  age_months: 6,
  sterilized: 'yes',
} as AnimalWithStatus

describe('Animals list census fields', () => {
  it('does not show age or sterilized on the grid or list card', () => {
    const { rerender } = render(
      <MemoryRouter>
        <AnimalCard animal={animal} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Mona')).toBeInTheDocument()
    expect(screen.queryByText('2 years 6 months')).toBeNull()
    expect(screen.queryByText('Add age')).toBeNull()
    expect(screen.queryByText('Sterilized')).toBeNull()

    rerender(
      <MemoryRouter>
        <AnimalCard animal={animal} variant="list" />
      </MemoryRouter>,
    )
    expect(screen.queryByText('2 years 6 months')).toBeNull()
    expect(screen.queryByText('Yes')).toBeNull()
  })
})