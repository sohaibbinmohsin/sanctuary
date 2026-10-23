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

  it('renders 3-step navigation header and Step 1 by default', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Animal')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Medical emergency')).toBeInTheDocument()
  })

  it('navigates from Step 1 to Step 2 when complaint is provided', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )
    const complaintInput = screen.getByPlaceholderText(/Describe the injury/i)
    fireEvent.change(complaintInput, { target: { value: 'Severe leg injury' } })
    const continueBtn = screen.getByRole('button', { name: /Continue to Location/i })
    fireEvent.click(continueBtn)
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Area or Neighborhood/i)).toBeInTheDocument()
  })

  it('allows clicking previous step in progress indicator to go back', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )
    const complaintInput = screen.getByPlaceholderText(/Describe the injury/i)
    fireEvent.change(complaintInput, { target: { value: 'Severe leg injury' } })
    const continueBtn = screen.getByRole('button', { name: /Continue to Location/i })
    fireEvent.click(continueBtn)
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument()

    const step1Trigger = screen.getByRole('button', { name: /Animal/i })
    fireEvent.click(step1Trigger)
    expect(screen.getByPlaceholderText(/Describe the injury/i)).toBeInTheDocument()
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

    const complaintInput = screen.getByPlaceholderText(/Describe the injury/i)
    fireEvent.change(complaintInput, { target: { value: 'Broken leg' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location/i }))

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

    // Step 1
    const complaintInput = screen.getByPlaceholderText(/Describe the injury/i)
    fireEvent.change(complaintInput, { target: { value: 'Hit by motorcycle' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location/i }))

    // Step 2
    const areaInput = screen.getByLabelText(/Area or Neighborhood/i)
    fireEvent.change(areaInput, { target: { value: 'DHA Phase 5' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 3
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
    fireEvent.change(screen.getByPlaceholderText(/Describe the injury/i), { target: { value: 'Spam report' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location/i }))

    // Step 2
    fireEvent.change(screen.getByLabelText(/Area or Neighborhood/i), { target: { value: 'Spam area' } })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Contact/i }))

    // Step 3
    fireEvent.change(screen.getByLabelText(/Mobile phone/i), { target: { value: '0300 1234567' } })

    // Fill honeypot
    const honeypot = document.querySelector('input[name="sanctuary_security_trap"]') as HTMLInputElement
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
    expect(closeBtn).toBeInTheDocument()
    fireEvent.click(closeBtn)

    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('closes dialog when Escape key is pressed', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<PublicReportScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toContain('--')
  })
})
