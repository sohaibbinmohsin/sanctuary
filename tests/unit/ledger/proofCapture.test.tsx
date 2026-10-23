import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProofCapture } from '@/features/ledger/components/ProofCapture'

// Mock PowerSync & hooks
const mockQueryResult = { data: [] }
vi.mock('@powersync/react', () => ({
  useQuery: () => mockQueryResult,
}))

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    execute: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  }),
}))

const mockCanTakePhoto = vi.fn()
vi.mock('@/shared/hooks/useCanTakePhoto', () => ({
  useCanTakePhoto: () => mockCanTakePhoto(),
}))

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

vi.mock('@/features/ledger/domain/attachments', () => ({
  countPendingAttachments: vi.fn().mockResolvedValue(0),
  deleteLedgerAttachment: vi.fn().mockResolvedValue(undefined),
  processLedgerAttachmentQueue: vi.fn().mockResolvedValue(undefined),
  queueLedgerAttachment: vi.fn().mockResolvedValue(undefined),
  resolveAttachmentUrl: vi.fn().mockResolvedValue('blob:test'),
}))

describe('ProofCapture custom plus button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanTakePhoto.mockReturnValue(false)
  })

  it('renders the custom plus button in photo-strip under proof label', () => {
    render(<ProofCapture orgId="org1" />)

    expect(screen.getByText(/proof/i)).toBeInTheDocument()
    const plusBtn = screen.getByRole('button', { name: /add proof/i })
    expect(plusBtn).toBeInTheDocument()
    expect(plusBtn).toHaveClass('photo-strip__thumb', 'photo-strip__add')
  })

  it('directly clicks file input on desktop mode when plus button is clicked', () => {
    mockCanTakePhoto.mockReturnValue(false)
    const { container } = render(<ProofCapture orgId="org1" />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const plusBtn = screen.getByRole('button', { name: /add proof/i })
    fireEvent.click(plusBtn)

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows menu popup with Take photo and From gallery in mobile mode when plus button is clicked', () => {
    mockCanTakePhoto.mockReturnValue(true)
    render(<ProofCapture orgId="org1" />)

    const plusBtn = screen.getByRole('button', { name: /add proof/i })
    fireEvent.click(plusBtn)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /take photo/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /from gallery/i })).toBeInTheDocument()
  })

  it('displays pending photo thumbnails and remove button', () => {
    const fakeFile = new File(['dummy'], 'receipt.jpg', { type: 'image/jpeg' })
    const onPendingFilesChange = vi.fn()

    // Mock URL.createObjectURL
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:receipt-preview')
    URL.revokeObjectURL = vi.fn()

    render(
      <ProofCapture
        orgId="org1"
        pendingFiles={[fakeFile]}
        onPendingFilesChange={onPendingFilesChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Proof 1' })).toBeInTheDocument()
    const removeBtn = screen.getByRole('button', { name: /remove proof 1/i })
    expect(removeBtn).toBeInTheDocument()

    fireEvent.click(removeBtn)
    expect(onPendingFilesChange).toHaveBeenCalledWith([])

    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })
})
