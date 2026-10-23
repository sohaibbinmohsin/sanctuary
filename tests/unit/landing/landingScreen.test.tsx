import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { LandingScreen } from '@/features/landing/LandingScreen'

describe('LandingScreen animal welfare network', () => {
  it('renders brand subheadline as Animal welfare network', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.getByText('Animal welfare network')).toBeInTheDocument()
  })

  it('renders primary emergency Report a case CTA and secondary Sign in', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    const reportBtn = screen.getByRole('button', { name: /Report a case/i })
    expect(reportBtn).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Sign in/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('opens ReportCaseModal when Report a case is clicked', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Report a case/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Report an animal in distress/i)).toBeInTheDocument()
  })

  it('renders all 5 stakeholder network pillars', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.getByText(/Citizens and Advocates/i)).toBeInTheDocument()
    expect(screen.getByText(/Field Rescue Teams/i)).toBeInTheDocument()
    expect(screen.getByText(/Shelters and Sanctuaries/i)).toBeInTheDocument()
    expect(screen.getByText(/Veterinarians and Clinics/i)).toBeInTheDocument()
    expect(screen.getByText(/Pet Guardians and Owners/i)).toBeInTheDocument()
  })

  it('contains no em-dashes anywhere in rendered body', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    const text = container.textContent || ''
    expect(text).not.toContain('—')
    expect(text).not.toContain('--')
  })
})
