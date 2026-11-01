import { render, screen } from '@testing-library/react'
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

  it('renders primary Report a case CTA linking to /report and a single topbar Sign in link', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    const reportLink = screen.getByRole('link', { name: /Report a case/i })
    expect(reportLink).toBeInTheDocument()
    expect(reportLink).toHaveAttribute('href', '/report')
    const signInLinks = screen.getAllByRole('link', { name: /Sign in/i })
    expect(signInLinks).toHaveLength(1)
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
    expect(text).not.toContain('\u2014')
    expect(text).not.toContain('--')
  })
})
