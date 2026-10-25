import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicReportTrackScreen } from '@/features/reports/screens/PublicReportTrackScreen'

const mockReport = {
  id: 'rep-1',
  report_number: 'SANCTUARY-0142',
  status: 'logged',
  species: 'Dog',
  animal_count: 1,
  chief_complaint: 'Hit by rickshaw, fractured leg',
  city: 'Lahore',
  location_area: 'Gulberg',
  location_landmark: 'Near Main Market',
  reporter_phone: '03001234567',
  reporter_cnic: '4210112345671',
  stage_logged_at: '2026-10-23T12:00:00Z',
  created_at: '2026-10-23T12:00:00Z',
}

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockImplementation(async (_sql: string, params: any[]) => {
      if (
        params?.includes('SANCTUARY-0142') ||
        params?.includes('Sanctuary-0142') ||
        params?.includes('Sanctuary-R0142') ||
        params?.includes('SANCTUARY-R0142')
      ) {
        return mockReport
      }
      return null
    }),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}))

describe('PublicReportTrackScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders case number as a heading with pure numbers and pipeline status', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    const heading = await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    expect(heading).toBeInTheDocument()
    expect(screen.getAllByText(/Logged/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Dispatched/i)).toBeInTheDocument()
    expect(screen.getByText('Oct 23')).toBeInTheDocument()
  })

  it('renders thank you message, reality check, and legal advocacy context', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    // The report was created in the past (> 12 hours ago), so extended delay + legal advocacy copy is displayed
    expect(screen.getByText(/Still awaiting an available rescue unit/i)).toBeInTheDocument()
    expect(screen.getByText(/Your report is already making a difference/i)).toBeInTheDocument()
    expect(screen.getByText(/animal rights lawyers and policy advocates/i)).toBeInTheDocument()
  })

  it('renders rescuing partner or network dispatch card with marketing visibility', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    // In logged state with Lahore city, displays Network Dispatch
    expect(screen.getByText(/Network Dispatch Active/i)).toBeInTheDocument()
    expect(screen.getByText(/Broadcasting across verified partner rescue units and institutions in Lahore/i)).toBeInTheDocument()
  })

  it('renders assigned partner with logo, name, and social follow button when accepted', async () => {
    localStorage.setItem(
      'sanctuary_public_reports_v1',
      JSON.stringify({
        'PARC-R200': {
          ...mockReport,
          report_number: 'PARC-R200',
          status: 'accepted',
          city: 'Islamabad',
        },
      })
    )
    render(
      <MemoryRouter initialEntries={['/report/track/PARC-R200']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #200' })
    expect(screen.getByText('Police Animal Rescue Center')).toBeInTheDocument()
    expect(screen.getByText(/Assigned Responding Unit/i)).toBeInTheDocument()
    const followLink = screen.getByRole('link', { name: /Support and follow their work/i })
    expect(followLink).toHaveAttribute('href', 'https://www.instagram.com/parcpoliceanimalrescuecentre/')
  })

  it('collapses case details into expandable details element', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    expect(screen.getByText(/View submitted report details/i)).toBeInTheDocument()
    expect(screen.getByText('Chief Complaint')).toBeInTheDocument()
    expect(screen.getByText('Animal Details')).toBeInTheDocument()
    expect(screen.getByText('Rescue Location')).toBeInTheDocument()
    expect(screen.getByText('Reporter Details')).toBeInTheDocument()
  })

  it('masks reporter personal contact data', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    expect(screen.getByText('0300 ···· 567')).toBeInTheDocument()
    expect(screen.getByText('42101-·······-1')).toBeInTheDocument()
    expect(screen.queryByText('03001234567')).toBeNull()
  })

  it('contains strictly zero administrative edit buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    expect(screen.queryByRole('button', { name: /Edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Dismiss/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull()
  })

  it('falls back to localStorage when db does not contain report', async () => {
    localStorage.setItem(
      'sanctuary_public_reports_v1',
      JSON.stringify({
        'SANCTUARY-R555': {
          ...mockReport,
          report_number: 'SANCTUARY-R555',
          chief_complaint: 'Saved in localStorage',
        },
      })
    )
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-R555']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Case #555' })).toBeInTheDocument()
    expect(screen.getByText('Saved in localStorage')).toBeInTheDocument()
  })

  it('supports localStorage array format fallback', async () => {
    localStorage.setItem(
      'sanctuary_public_reports_v1',
      JSON.stringify([
        {
          ...mockReport,
          report_number: 'SANCTUARY-R777',
          chief_complaint: 'Array storage format',
        },
      ])
    )
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-R777']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Case #777' })).toBeInTheDocument()
    expect(screen.getByText('Array storage format')).toBeInTheDocument()
  })

  it('displays friendly case not found state when not in db or local storage', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-UNKNOWN']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText(/Case not found/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Report an emergency|Submit new report|Report/i })).toBeInTheDocument()
  })

  it('copies tracking link when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    const copyBtn = screen.getByRole('button', { name: /Copy tracking link/i })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href)
    await waitFor(() => {
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument()
    })
  })

  it('renders attached case photos when present', async () => {
    localStorage.setItem(
      'sanctuary_public_reports_v1',
      JSON.stringify({
        'SANCTUARY-R777': {
          ...mockReport,
          report_number: 'SANCTUARY-R777',
          photos: [
            { id: 'p1', url: 'https://images.example.com/rescue-dog.jpg' },
          ],
        },
      })
    )
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-R777']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #777' })
    expect(screen.getByText('Case Photos')).toBeInTheDocument()
    const img = screen.getByAltText('Case photo 1')
    expect(img).toHaveAttribute('src', 'https://images.example.com/rescue-dog.jpg')
  })

  it('contains strictly zero em-dashes', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 1, name: 'Case #0142' })
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toContain('--')
  })
})
