import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

const mockConfirm = vi.fn().mockResolvedValue(true)
vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
}))

const mockGetAll = vi.fn()
const mockExecute = vi.fn().mockResolvedValue(undefined)
const mockWriteTransaction = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
  return cb({
    execute: mockExecute,
  })
})

let currentAnimalData: any

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockImplementation(async () => currentAnimalData),
    getAll: mockGetAll,
    execute: mockExecute,
    writeTransaction: mockWriteTransaction,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalDetailScreen Relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockResolvedValue(true)
    currentAnimalData = {
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      life_stage: 'adult',
      sex: 'Male',
      markings: 'White patch on chest',
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    }

    mockGetAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM animal_relationships')) {
        return []
      }
      if (sql.includes('FROM animals') && !sql.includes('animal_relationships')) {
        return [
          {
            id: 'anim-2',
            org_id: 'org-1',
            shelter_code: 'MS-0002',
            name: 'Bella',
            species: 'Dog',
            life_stage: 'adult',
            status_id: 'st-intake',
            status_label: 'Intake',
          },
          {
            id: 'anim-3',
            org_id: 'org-1',
            shelter_code: 'MS-0003',
            name: 'Oliver',
            species: 'Cat',
            life_stage: 'child',
            status_id: 'st-intake',
            status_label: 'Intake',
          },
        ]
      }
      return []
    })

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

  it('renders Relationships section with empty state when no relationships exist', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    expect(screen.getByRole('heading', { level: 2, name: 'Relationships' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Link animal/i })).toBeInTheDocument()
    expect(
      screen.getByText(
        'No linked animals yet. Record family members, bonded pairs, or incompatibility warnings.',
      ),
    ).toBeInTheDocument()
  })

  it('renders linked animals with correct badges, thumbnail, and navigation link', async () => {
    mockGetAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM animal_relationships')) {
        return [
          {
            id: 'rel-1',
            org_id: 'org-1',
            animal_id: 'anim-1',
            related_animal_id: 'anim-2',
            relationship_type: 'bonded',
            notes: 'Bonded pair since shelter intake',
            created_at: '2026-10-06T00:00:00Z',
            related_name: 'Bella',
            related_shelter_code: 'MS-0002',
            related_species: 'Dog',
            related_life_stage: 'adult',
            related_photo_url: null,
          },
          {
            id: 'rel-2',
            org_id: 'org-1',
            animal_id: 'anim-1',
            related_animal_id: 'anim-3',
            relationship_type: 'incompatible',
            notes: 'Reacts aggressively when eating near cats',
            created_at: '2026-10-06T01:00:00Z',
            related_name: 'Oliver',
            related_shelter_code: 'MS-0003',
            related_species: 'Cat',
            related_life_stage: 'child',
            related_photo_url: 'https://cdn.example.com/oliver.jpg',
          },
          {
            id: 'rel-3',
            org_id: 'org-1',
            animal_id: 'anim-1',
            related_animal_id: 'anim-4',
            relationship_type: 'mother',
            notes: null,
            created_at: '2026-10-06T02:00:00Z',
            related_name: 'Milo',
            related_shelter_code: 'MS-0004',
            related_species: 'Dog',
            related_life_stage: 'child',
            related_photo_url: null,
          },
        ]
      }
      return []
    })

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    // Check Bella row
    const bellaLink = screen.getByRole('link', { name: /Bella/i })
    expect(bellaLink).toHaveAttribute('href', '/animals/anim-2')
    expect(screen.getByText('Bonded pair since shelter intake')).toBeInTheDocument()

    // Bonded badge (forest tone)
    const bondedBadge = screen.getByText('Bonded')
    expect(bondedBadge).toHaveClass('status-badge--forest')

    // Incompatible badge (danger red tone)
    const incompatibleBadge = screen.getByText('Incompatible')
    expect(incompatibleBadge).toHaveClass('status-badge--danger')

    // Mother badge (warm amber tone)
    const motherBadge = screen.getByText('Mother')
    expect(motherBadge).toHaveClass('status-badge--amber')

    // Oliver photo thumbnail
    const oliverImg = screen.getByAltText(/Oliver/i)
    expect(oliverImg).toHaveAttribute('src', 'https://cdn.example.com/oliver.jpg')
  })

  it('unlinks an animal with confirmation', async () => {
    mockGetAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM animal_relationships')) {
        return [
          {
            id: 'rel-1',
            org_id: 'org-1',
            animal_id: 'anim-1',
            related_animal_id: 'anim-2',
            relationship_type: 'bonded',
            notes: 'Bonded pair',
            created_at: '2026-10-06T00:00:00Z',
            related_name: 'Bella',
            related_shelter_code: 'MS-0002',
            related_species: 'Dog',
            related_life_stage: 'adult',
            related_photo_url: null,
          },
        ]
      }
      return []
    })

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    const unlinkBtn = screen.getByRole('button', { name: /Unlink/i })
    fireEvent.click(unlinkBtn)

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Unlink/i),
        tone: 'danger',
      }),
    )

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM animal_relationships WHERE animal_id = ? AND related_animal_id = ?'),
        ['anim-1', 'anim-2'],
      )
    })
  })

  it('opens LinkAnimalModal, filters animals, selects type, and links animals successfully', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    const linkBtn = screen.getByRole('button', { name: /\+ Link animal/i })
    fireEvent.click(linkBtn)

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Link animal/i })).toBeInTheDocument()

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search by ID or name/i)
    fireEvent.change(searchInput, { target: { value: 'Bella' } })

    // Select Bella from options
    const bellaOption = await screen.findByRole('option', { name: /Bella/i })
    fireEvent.click(bellaOption)

    // Select relationship type: Bonded, Mother, Child, Sibling, Incompatible
    const motherPill = screen.getByRole('button', { name: /^Mother$/i })
    fireEvent.click(motherPill)

    // Notes
    const notesInput = screen.getByPlaceholderText(/notes/i)
    fireEvent.change(notesInput, { target: { value: 'Adopted together as mother/pup' } })

    // Save button
    const saveBtn = screen.getByRole('button', { name: /^Save$/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO animal_relationships'),
        expect.arrayContaining(['org-1', 'anim-1', 'anim-2', 'mother', 'Adopted together as mother/pup']),
      )
    })
  })

  it('has DM Mono font styling for Shelter Code in characteristics grid', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    const grid = document.querySelector('.characteristics-grid') as HTMLElement
    expect(grid).toBeInTheDocument()
    const shelterCodeValue = within(grid).getByText('MS-0001')
    expect(shelterCodeValue).toHaveClass('characteristic-value', 'shelter-code')
  })
})
