import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const baseAnimal: AnimalWithStatus = {
  id: 'a1',
  org_id: 'org1',
  shelter_code: 'TS-001',
  name: null,
  species: 'Dog',
  sex: null,
  markings: null,
  notes: null,
  archived: 0,
  intake_date: '2026-10-03',
  status_id: 's1',
  status_labels: ['Intake'],
  created_at: '2026-10-03T00:00:00Z',
  updated_at: '2026-10-03T00:00:00Z',
}

describe('AnimalCard stub indicator', () => {
  it('does not display Add details badge when species is known', () => {
    render(
      <MemoryRouter>
        <AnimalCard animal={baseAnimal} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/add details/i)).toBeNull()
  })

  it('does not display Add details badge when species is Unknown, shows status badge', () => {
    render(
      <MemoryRouter>
        <AnimalCard animal={{ ...baseAnimal, species: 'Unknown', status_labels: ['Intake'] }} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/add details/i)).toBeNull()
    expect(screen.getByText('Intake')).toBeInTheDocument()
  })
})

describe('splitSpecies for stub editing', () => {
  it('defaults to Dog preset with empty other when species is Unknown', async () => {
    const { splitSpecies } = await import('@/features/animals/screens/AnimalIntakeScreen')
    expect(splitSpecies('Unknown')).toEqual({ preset: 'Dog', other: '' })
    expect(splitSpecies('  Unknown  ')).toEqual({ preset: 'Dog', other: '' })
    expect(splitSpecies('')).toEqual({ preset: 'Dog', other: '' })
    expect(splitSpecies(null)).toEqual({ preset: 'Dog', other: '' })
  })

  it('keeps known presets and other species intact', async () => {
    const { splitSpecies } = await import('@/features/animals/screens/AnimalIntakeScreen')
    expect(splitSpecies('Cat')).toEqual({ preset: 'Cat', other: '' })
    expect(splitSpecies('Goat')).toEqual({ preset: 'Other', other: 'Goat' })
  })
})
