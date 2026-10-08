import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AddAnimalSplitButton } from '@/features/animals/components/AddAnimalSplitButton'
import * as useIsMobileHook from '@/shared/hooks/useIsMobile'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('AddAnimalSplitButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(useIsMobileHook, 'useIsMobile').mockReturnValue(false)
  })

  it('renders split button with Add animal and down arrow', () => {
    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Add animal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add animal options' })).toBeInTheDocument()
  })

  it('on desktop: clicking Add animal navigates directly to /animals/new', () => {
    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add animal' }))
    expect(mockNavigate).toHaveBeenCalledWith('/animals/new')
  })

  it('on desktop: clicking down arrow flips open dropdown with Form first, Camera second', () => {
    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    const toggle = screen.getByRole('button', { name: 'Add animal options' })
    fireEvent.click(toggle)

    // Dropdown items
    const formItem = screen.getByRole('menuitem', { name: /Add animal form/i })
    const cameraItem = screen.getByRole('menuitem', { name: /Take photo/i })
    expect(formItem).toBeInTheDocument()
    expect(cameraItem).toBeInTheDocument()

    // Clicking form navigates to /animals/new
    fireEvent.click(formItem)
    expect(mockNavigate).toHaveBeenCalledWith('/animals/new')
  })

  it('on mobile: clicking Add animal directly triggers camera input', () => {
    vi.spyOn(useIsMobileHook, 'useIsMobile').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    const cameraInput = screen.getByLabelText('Take animal photo') as HTMLInputElement
    const clickSpy = vi.spyOn(cameraInput, 'click')

    fireEvent.click(screen.getByRole('button', { name: 'Add animal' }))
    expect(clickSpy).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('on mobile: capturing a photo navigates to /animals/new with initialPhoto in state', () => {
    vi.spyOn(useIsMobileHook, 'useIsMobile').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    const cameraInput = screen.getByLabelText('Take animal photo') as HTMLInputElement
    const fakeFile = new File(['cat'], 'cat.jpg', { type: 'image/jpeg' })

    fireEvent.change(cameraInput, { target: { files: [fakeFile] } })

    expect(mockNavigate).toHaveBeenCalledWith('/animals/new', {
      state: { initialPhoto: fakeFile },
    })
  })

  it('on mobile: clicking down arrow opens sheet with Camera and Form options', () => {
    vi.spyOn(useIsMobileHook, 'useIsMobile').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AddAnimalSplitButton />
      </MemoryRouter>
    )

    const toggle = screen.getByRole('button', { name: 'Add animal options' })
    fireEvent.click(toggle)

    // Sheet modal opens with title Add animal
    expect(screen.getByRole('heading', { level: 2, name: 'Add animal' })).toBeInTheDocument()

    // Contains options
    const cameraOption = screen.getByRole('button', { name: /Take photo/i })
    const formOption = screen.getByRole('button', { name: /Add animal form/i })
    expect(cameraOption).toBeInTheDocument()
    expect(formOption).toBeInTheDocument()

    // Form option navigates to /animals/new
    fireEvent.click(formOption)
    expect(mockNavigate).toHaveBeenCalledWith('/animals/new')
  })
})
