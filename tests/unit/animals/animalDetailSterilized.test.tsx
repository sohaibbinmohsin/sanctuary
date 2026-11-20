import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockExecute = vi.fn().mockResolvedValue(undefined)
const mockGetAll = vi.fn().mockResolvedValue([])
let currentAnimal: Record<string, unknown>

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockImplementation(async () => currentAnimal),
    getAll: mockGetAll,
    execute: mockExecute,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'AWS', orgName: 'Animal Welfare Society LUMS', role: 'admin', userId: 'user-1' },
    loading: false,
  }),
}))

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/animals/anim-1']}>
      <Routes>
        <Route path="/animals/:id" element={<AnimalDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Animal detail sterilized', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentAnimal = {
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'AWS-0001',
      name: 'Mona',
      species: 'Cat',
      life_stage: 'adult',
      sex: 'Female',
      sterilized: null,
      markings: null,
      age_years: null,
      age_months: null,
      intake_date: '2026-11-20',
      status_id: 'st-1',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    }
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

  it('shows sterilized under sex and saves Yes from the edit sheet', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('tab', { name: /Details/i }))

    const sexLabel = screen.getByText('Sex')
    const sterilizedLabel = screen.getByText('Sterilized')
    expect(sexLabel.compareDocumentPosition(sterilizedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Edit details/i }))
    const dialog = screen.getByRole('dialog')
    const sex = within(dialog).getByRole('group', { name: 'Sex' })
    const sterilized = within(dialog).getByRole('group', { name: 'Sterilized' })
    expect(sex.compareDocumentPosition(sterilized) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(sterilized).getByRole('button', { name: 'Yes' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      const update = mockExecute.mock.calls.find(([sql]) => String(sql).includes('UPDATE animals'))
      expect(update?.[1]).toContain('yes')
    })
  })
})