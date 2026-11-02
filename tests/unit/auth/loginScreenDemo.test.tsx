import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { LoginScreen } from '@/features/auth/LoginScreen'

describe('LoginScreen network updates', () => {
  it('renders Animal welfare network subheading and interactive demo link', () => {
    render(
      <MemoryRouter>
        <LoginScreen onSuccess={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText('Animal welfare network')).toBeInTheDocument()
    const demoLink = screen.getByRole('link', { name: /Try interactive demo/i })
    expect(demoLink).toBeInTheDocument()
    expect(demoLink).toHaveAttribute('href', '/playground')
  })
})
