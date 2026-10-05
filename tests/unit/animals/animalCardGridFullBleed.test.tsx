import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const baseAnimal: AnimalWithStatus = {
  id: 'anim-1',
  org_id: 'org-1',
  shelter_code: 'TS-001',
  name: 'Barnaby',
  species: 'Dog',
  sex: 'Male',
  markings: null,
  notes: null,
  archived: 0,
  intake_date: '2026-10-05',
  status_id: 'st-intake',
  status_label: 'Intake',
  status_labels: ['Intake'],
  created_at: '2026-10-05T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
}

describe('AnimalCard full-bleed grid layout', () => {
  it('renders top overlay with status tag and bottom overlay with name without separate card body', () => {
    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={baseAnimal} photoUrl="https://example.com/dog.jpg" hasVerifiedPhoto />
      </MemoryRouter>
    )

    const card = container.querySelector('.animal-card')
    expect(card).toHaveClass('animal-card--full-bleed')
    expect(container.querySelector('.animal-card__overlay-top')).toBeInTheDocument()
    expect(container.querySelector('.animal-card__overlay-bottom')).toBeInTheDocument()
    expect(screen.getByText('Intake')).toBeInTheDocument()
    expect(screen.getByText('Barnaby')).toBeInTheDocument()
    // Should NOT have the old separated white body
    expect(container.querySelector('.animal-card__body')).toBeNull()
  })

  it('renders full-bleed fallback gradient when no photo is present', () => {
    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={{ ...baseAnimal, name: null }} photoUrl={null} />
      </MemoryRouter>
    )

    expect(container.querySelector('.animal-card--no-photo')).toBeInTheDocument()
    expect(screen.getByText('TS-001')).toBeInTheDocument()
    expect(screen.getByText('Intake')).toBeInTheDocument()
  })
})
