import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { SanctuaryFooter } from '@/shared/ui/SanctuaryFooter'

describe('SanctuaryFooter', () => {
  it('renders branding and tagline', () => {
    render(
      <MemoryRouter>
        <SanctuaryFooter />
      </MemoryRouter>
    )
    expect(screen.getByText('Sanctuary')).toBeInTheDocument()
    expect(
      screen.getByText(/The animal welfare network connecting rescuers, shelters, clinics, and animal guardians/i)
    ).toBeInTheDocument()
  })

  it('renders all social and contact links with correct URLs', () => {
    render(
      <MemoryRouter>
        <SanctuaryFooter />
      </MemoryRouter>
    )

    const waLink = screen.getByLabelText(/Contact us on WhatsApp/i)
    expect(waLink).toHaveAttribute('href', 'https://wa.me/923390008674')
    expect(waLink).toHaveAttribute('target', '_blank')

    const emailLink = screen.getByLabelText(/Email: hello@themohsinproject\.org/i)
    expect(emailLink).toHaveAttribute('href', 'mailto:hello@themohsinproject.org')

    const linkedinLink = screen.getByLabelText(/The Mohsin Project on LinkedIn/i)
    expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/company/themohsinproject/')
    expect(linkedinLink).toHaveAttribute('target', '_blank')

    const instagramLink = screen.getByLabelText(/The Mohsin Project on Instagram/i)
    expect(instagramLink).toHaveAttribute('href', 'https://www.instagram.com/themohsinproject/')
    expect(instagramLink).toHaveAttribute('target', '_blank')

    const mohsinLink = screen.getByRole('link', { name: 'The Mohsin Project' })
    expect(mohsinLink).toHaveAttribute('href', 'https://themohsinproject.org/')
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <MemoryRouter>
        <SanctuaryFooter />
      </MemoryRouter>
    )
    const text = container.textContent || ''
    expect(text).not.toContain('\u2014')
    expect(text).not.toContain('--')
  })
})
