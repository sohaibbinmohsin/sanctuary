import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicReportScreen } from '@/features/reports/screens/PublicReportScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    execute: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    getOptional: vi.fn().mockResolvedValue(null),
  }),
}))

describe('PublicReportScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders 2-step navigation header and Step 1 by default', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Photos & Location')).toBeInTheDocument()
    expect(screen.getByText('Contact & Submit')).toBeInTheDocument()
    expect(screen.getByText('Sick / Injured Animal')).toBeInTheDocument()
    expect(screen.getByText('Use current location')).toBeInTheDocument()
    expect(screen.getByText('Enter location manually')).toBeInTheDocument()
  })

  it('navigates from Step 1 to Step 2 when photo and area are provided', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'Gulberg III' } })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    const continueBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    fireEvent.click(continueBtn)

    expect(screen.getByLabelText(/Mobile phone/i)).toBeInTheDocument()
  })

  it('allows clicking previous step in progress indicator to go back', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'Gulberg III' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    const continueBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    fireEvent.click(continueBtn)
    expect(screen.getByLabelText(/Mobile phone/i)).toBeInTheDocument()

    const step1Trigger = screen.getByRole('button', { name: /Photos & Location/i })
    fireEvent.click(step1Trigger)
    expect(screen.getByText('Sick / Injured Animal')).toBeInTheDocument()
  })

  it('pre-fills reporter contact details from saved profile if draft is empty', () => {
    localStorage.setItem(
      'sanctuary_reporter_profile_v1',
      JSON.stringify({
        name: 'Fatima Noor',
        phone: '0321 7654321',
        cnic: '35202-1234567-1',
        city: 'Lahore',
      })
    )

    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'Gulberg' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    const phoneInput = screen.getByLabelText(/Mobile phone/i) as HTMLInputElement
    const nameInput = screen.getByLabelText(/Your name/i) as HTMLInputElement
    expect(phoneInput.value).toBe('0321 7654321')
    expect(nameInput.value).toBe('Fatima Noor')
  })

  it('submits report successfully, caches in localStorage, and navigates to tracking', async () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
          <Route path="/report/track/:reportNumber" element={<div data-testid="track-page">Tracking Screen</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Step 1: Photos & Location
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'DHA Phase 5' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    const notesInput = screen.getByPlaceholderText(/Describe the injury, bleeding/i)
    fireEvent.change(notesInput, { target: { value: 'Hit by motorcycle' } })

    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 2: Contact & Submit
    const phoneInput = screen.getByLabelText(/Mobile phone/i)
    fireEvent.change(phoneInput, { target: { value: '0300 9876543' } })

    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('track-page')).toBeInTheDocument()
    })

    const cachedRaw = localStorage.getItem('sanctuary_public_reports_v1')
    expect(cachedRaw).not.toBeNull()
    const cached = JSON.parse(cachedRaw!)
    const keys = Object.keys(cached)
    expect(keys.length).toBeGreaterThan(0)
    expect(cached[keys[0]!].chief_complaint).toBe('Hit by motorcycle')
    expect(cached[keys[0]!].location_area).toBe('DHA Phase 5')
    expect(cached[keys[0]!].photos).toBeDefined()
  })

  it('submits with fallback complaint if situation note is left empty', async () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
          <Route path="/report/track/:reportNumber" element={<div data-testid="track-page">Tracking Screen</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Step 1: Photos & Location (empty complaint)
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'Model Town' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 2: Contact
    const phoneInput = screen.getByLabelText(/Mobile phone/i)
    fireEvent.change(phoneInput, { target: { value: '0300 1112233' } })

    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('track-page')).toBeInTheDocument()
    })

    const cachedRaw = localStorage.getItem('sanctuary_public_reports_v1')
    const cached = JSON.parse(cachedRaw!)
    const keys = Object.keys(cached)
    expect(cached[keys[0]!].chief_complaint).toBe('Sick or injured animal report with visual evidence')
  })

  it('traps automated bot submissions with honeypot and redirects to dummy track', async () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
          <Route path="/report/track/:reportNumber" element={<div data-testid="track-page">Tracking Screen</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Step 1
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    fireEvent.change(screen.getByLabelText(/Area or Neighborhood/i), { target: { value: 'Spam area' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 2
    fireEvent.change(screen.getByLabelText(/Mobile phone/i), { target: { value: '0300 1234567' } })

    // Fill honeypot
    const honeypot = document.querySelector('input[name="fax_number"]') as HTMLInputElement
    expect(honeypot).toBeInTheDocument()
    fireEvent.change(honeypot, { target: { value: 'bot_spam_value' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit Emergency Report/i }))

    await waitFor(() => {
      expect(screen.getByTestId('track-page')).toBeInTheDocument()
    })

    // Cached reports should NOT have been written
    const cachedRaw = localStorage.getItem('sanctuary_public_reports_v1')
    expect(cachedRaw).toBeNull()
  })

  it('rejects submissions that are completed faster than minSubmissionDurationMs (bot time-gate)', async () => {
    localStorage.clear()
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<div data-testid="track-page">Track Page</div>} />
          <Route path="/report" element={<PublicReportScreen minSubmissionDurationMs={5000} />} />
        </Routes>
      </MemoryRouter>
    )

    // Step 1
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    fireEvent.change(screen.getByLabelText(/Area or Neighborhood/i), { target: { value: 'Rapid bot area' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 2: submit immediately (under 5000ms threshold)
    fireEvent.change(screen.getByLabelText(/Mobile phone/i), { target: { value: '0300 1234567' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit Emergency Report/i }))

    await waitFor(() => {
      expect(screen.getByTestId('track-page')).toBeInTheDocument()
    })

    // Cached reports should NOT have been written because it was intercepted by time-gate
    const cachedRaw = localStorage.getItem('sanctuary_public_reports_v1')
    expect(cachedRaw).toBeNull()
  })

  it('closes dialog and navigates when close button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const closeBtn = screen.getByRole('button', { name: /Close report dialog/i })
    fireEvent.click(closeBtn)
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('toggles Urdu language mode in report screen', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const langBtn = screen.getByRole('button', { name: /Switch language/i })
    fireEvent.click(langBtn)
    expect(screen.getByText('تصاویر اور مقام')).toBeInTheDocument()
  })
})
