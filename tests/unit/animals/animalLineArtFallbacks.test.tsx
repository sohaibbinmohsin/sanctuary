import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockGetAll = vi.fn()
const mockGetOptional = vi.fn()

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: mockGetOptional,
    getAll: mockGetAll,
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalCard Line Art Fallback', () => {
  it('renders AnimalLineArt when primaryPhotoUrl is null', () => {
    const animal = {
      id: 'a1',
      shelterCode: 'A-01',
      name: 'Barnaby',
      species: 'Dog',
      lifeStage: 'adult' as const,
      statusLabel: 'Intake',
      statusTone: 'forest' as const,
      primaryPhotoUrl: null,
      notes: null,
    }

    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={animal} />
      </MemoryRouter>
    )

    const lineArt = container.querySelector('.animal-line-art')
    expect(lineArt).toBeTruthy()
    expect(lineArt?.getAttribute('data-species')).toBe('dog')
  })

  it('renders AnimalLineArt in list variant when photoUrl is absent', () => {
    const animal = {
      id: 'a2',
      shelter_code: 'C-02',
      name: 'Whiskers',
      species: 'Cat',
      life_stage: 'child' as const,
      status_label: 'Intake',
      status_labels: ['Intake'],
    }

    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={animal} variant="list" />
      </MemoryRouter>
    )

    const lineArt = container.querySelector('.animal-line-art')
    expect(lineArt).toBeTruthy()
    expect(lineArt?.getAttribute('data-species')).toBe('cat')
    expect(lineArt?.getAttribute('data-stage')).toBe('child')
  })

  it('does not render AnimalLineArt when photoUrl is present', () => {
    const animal = {
      id: 'a3',
      shelter_code: 'D-03',
      name: 'Rover',
      species: 'Dog',
      life_stage: 'adult' as const,
      status_labels: ['Intake'],
    }

    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={animal} photoUrl="https://example.com/rover.jpg" />
      </MemoryRouter>
    )

    const lineArt = container.querySelector('.animal-line-art')
    expect(lineArt).toBeNull()
  })
})

describe('AnimalDetailScreen Line Art Fallback', () => {
  beforeEach(() => {
    if (typeof globalThis.caches === 'undefined') {
      vi.stubGlobal('caches', {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(false),
          keys: vi.fn().mockResolvedValue([]),
        }),
      })
    }
  })

  it('renders AnimalLineArt full-bleed in hero when animal has no photos', async () => {
    mockGetOptional.mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      life_stage: 'adult',
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    })
    mockGetAll.mockResolvedValue([])

    const { container } = render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText('Barnaby')
    const heroPhoto = container.querySelector('.detail-hero__photo')
    expect(heroPhoto).toBeTruthy()
    const lineArt = heroPhoto?.querySelector('.animal-line-art')
    expect(lineArt).toBeTruthy()
    expect(lineArt?.getAttribute('data-species')).toBe('dog')
    expect(lineArt?.getAttribute('data-stage')).toBe('adult')
  })
})
