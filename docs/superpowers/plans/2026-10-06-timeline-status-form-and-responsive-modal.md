# Timeline Status Form, Responsive Sheet Modals & Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate animal status selection into a dedicated status form inside the Timeline tab, build a reusable `ResponsiveSheetModal` (bottom sheet on mobile, centered card on desktop) for both status and care logging forms, redesign the timeline UI with status tags as primary elements, center-align the animal header action row, and upgrade the photo add button to a hospital/medical cross icon.

**Architecture:**
1. Create a `MedicalCrossIcon` component rendering a bold equilateral medical cross icon to replace thin math addition symbols in photo add buttons.
2. Build a reusable `ResponsiveSheetModal` component in `src/shared/ui/` that renders as a bottom sheet with drag handle and safe area padding on mobile viewports (<640px) and a centered modal card on desktop viewports.
3. Remove status pills from the `AnimalDetailScreen` profile header; in the `Timeline` tab, provide an "Update status" action that opens the status update form inside `ResponsiveSheetModal`.
4. Wrap the "Log care" / care edit form inside `ResponsiveSheetModal`.
5. Redesign the timeline milestone UI so the status badge is the primary element, timestamp is secondary, and notes are rendered optionally underneath.
6. Align `.detail-hero__title`, `.btn--inline-edit`, and `.animal-daily-care-btn` along a shared vertical center axis.

**Tech Stack:** React 19, TypeScript, React Router 7, PowerSync / SQLite, Phosphor Icons, CSS media queries, Vitest, Testing Library.

**Spec:** User feedback from 2026-10-06 session with reference image `media_1791290970175.jpg`.

## Global Constraints
- Light theme only, strictly adhering to Sanctuary design tokens (`--color-forest`, `--color-ink`, `--color-white`, `--font-display`, `--font-mono`, `--font-sans`).
- Outlined fonts: Outfit for display headers, DM Sans for body/controls, DM Mono for shelter codes.
- Touch targets >= 44px minimum touch area.
- No direct pushes to `main` under any circumstances; all work on dedicated feature branch `feature/camera-quick-intake`.
- Offline-first execution via PowerSync (`useDb` / `SanctuaryDb`).

---

### Task 1: Medical/Hospital Plus Icon (`MedicalCrossIcon`)

**Files:**
- Create: `src/shared/ui/MedicalCrossIcon.tsx`
- Modify: `src/features/animals/components/PhotoCapture.tsx:260-265`
- Modify: `src/features/animals/components/IntakePhotoPicker.tsx:135-140`
- Modify: `src/features/ledger/components/ProofCapture.tsx:287-292`
- Test: `tests/unit/shared/medicalCrossIcon.test.tsx`

**Interfaces:**
- Consumes: `{ size?: number, className?: string }`
- Produces: `<MedicalCrossIcon />` rendering an equilateral bold medical cross SVG

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/shared/medicalCrossIcon.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MedicalCrossIcon } from '@/shared/ui/MedicalCrossIcon'

describe('MedicalCrossIcon', () => {
  it('renders SVG with medical equilateral cross path', () => {
    const { container } = render(<MedicalCrossIcon size={24} className="test-cross" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
    expect(svg).toHaveClass('test-cross')
    const path = svg?.querySelector('path')
    expect(path).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/medicalCrossIcon.test.tsx`
Expected: FAIL (Cannot find module `@/shared/ui/MedicalCrossIcon`)

- [ ] **Step 3: Implement minimal code**

In `src/shared/ui/MedicalCrossIcon.tsx`:
```tsx
import type { SVGProps } from 'react'

export type MedicalCrossIconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export function MedicalCrossIcon({
  size = 20,
  className,
  ...props
}: MedicalCrossIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8.5 2.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-6v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6h-6a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h6v-6z" />
    </svg>
  )
}
```

Update `PhotoCapture.tsx`, `IntakePhotoPicker.tsx`, and `ProofCapture.tsx` to use `<MedicalCrossIcon size={20} />` for the add photo thumb button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shared/medicalCrossIcon.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/MedicalCrossIcon.tsx src/features/animals/components/PhotoCapture.tsx src/features/animals/components/IntakePhotoPicker.tsx src/features/ledger/components/ProofCapture.tsx tests/unit/shared/medicalCrossIcon.test.tsx
git commit -m "feat(ui): use MedicalCrossIcon for photo add buttons"
```

---

### Task 2: Center-Align Animal Title, Edit Pencil, and Daily Care Button

**Files:**
- Modify: `src/styles/global.css:3719-3745`
- Test: `tests/unit/animals/animalDetailHeaderAlignment.test.tsx`

**Interfaces:**
- Consumes: `.detail-hero__id-row`, `.detail-hero__title-wrap`, `.detail-hero__title`, `.btn--inline-edit`, `.animal-daily-care-btn`
- Produces: Pixel-perfect vertical center alignment across title, inline pencil, and daily care button

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailHeaderAlignment.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalDetailScreen header alignment', () => {
  it('renders title-wrap and daily care button in aligned id-row', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const idRow = await screen.findByRole('heading', { level: 1, name: 'Barnaby' })
    const parentRow = idRow.closest('.detail-hero__id-row')
    expect(parentRow).toBeInTheDocument()
    expect(parentRow?.querySelector('.btn--inline-edit')).toBeInTheDocument()
    expect(parentRow?.querySelector('.animal-daily-care-btn')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it passes/fails**

Run: `npx vitest run tests/unit/animals/animalDetailHeaderAlignment.test.tsx`
Expected: Passes DOM check; verify styles in `global.css`.

- [ ] **Step 3: Implement minimal code**

In `src/styles/global.css`:
```css
.detail-hero__id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.detail-hero__title-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  min-height: var(--touch-min, 44px);
}

.detail-hero__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  color: var(--color-ink);
}

.btn--inline-edit {
  position: relative;
  width: 2.25rem !important;
  height: 2.25rem !important;
  min-height: 2.25rem !important;
  padding: 0 !important;
  border-radius: 999px;
  color: var(--color-ink-muted);
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0;
}

.animal-daily-care-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-family: var(--font-body, "DM Sans", sans-serif);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  min-height: var(--touch-min, 44px);
  border-radius: 999px;
  border: 1px solid var(--color-forest, #2F5D3A);
  background: transparent;
  color: var(--color-forest, #2F5D3A);
  cursor: pointer;
  transition: all var(--duration) var(--ease-out);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailHeaderAlignment.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css tests/unit/animals/animalDetailHeaderAlignment.test.tsx
git commit -m "fix(animals): center-align title, inline edit pencil, and daily care button"
```

---

### Task 3: Reusable `ResponsiveSheetModal` Component

**Files:**
- Create: `src/shared/ui/ResponsiveSheetModal.tsx`
- Create: `src/shared/ui/ResponsiveSheetModal.css`
- Test: `tests/unit/shared/responsiveSheetModal.test.tsx`

**Interfaces:**
- Consumes: `{ isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }`
- Produces: `<ResponsiveSheetModal />` rendering bottom sheet on mobile (<640px) and centered card on desktop with grayed-out backdrop

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/shared/responsiveSheetModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'

describe('ResponsiveSheetModal', () => {
  it('renders modal when open with title, children, backdrop, and calls onClose on backdrop click or close button', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ResponsiveSheetModal isOpen={false} onClose={onClose} title="Update Status">
        <p>Form Content</p>
      </ResponsiveSheetModal>
    )

    expect(screen.queryByText('Update Status')).toBeNull()

    rerender(
      <ResponsiveSheetModal isOpen={true} onClose={onClose} title="Update Status">
        <p>Form Content</p>
      </ResponsiveSheetModal>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Update Status')).toBeInTheDocument()
    expect(screen.getByText('Form Content')).toBeInTheDocument()

    const closeBtn = screen.getByLabelText(/Close modal/i)
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    const backdrop = document.querySelector('.responsive-modal__backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/responsiveSheetModal.test.tsx`
Expected: FAIL (Cannot find module `@/shared/ui/ResponsiveSheetModal`)

- [ ] **Step 3: Implement minimal code**

In `src/shared/ui/ResponsiveSheetModal.tsx`:
```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import './ResponsiveSheetModal.css'

export type ResponsiveSheetModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function ResponsiveSheetModal({
  isOpen,
  onClose,
  title,
  children,
}: ResponsiveSheetModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="responsive-modal-root" role="dialog" aria-modal="true">
      <div className="responsive-modal__backdrop" onClick={onClose} />
      <div className="responsive-modal__card">
        <div className="responsive-modal__header">
          <h2 className="responsive-modal__title">{title}</h2>
          <button
            type="button"
            className="responsive-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="responsive-modal__content">{children}</div>
      </div>
    </div>,
    document.body
  )
}
```

In `src/shared/ui/ResponsiveSheetModal.css`:
```css
.responsive-modal-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  background: rgba(15, 29, 21, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: responsive-modal-fade-in 200ms ease-out forwards;
}

@keyframes responsive-modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.responsive-modal__backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  cursor: pointer;
}

.responsive-modal__card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem) calc(var(--space-4, 1rem) + env(safe-area-inset-bottom, 0px) + var(--safe-bottom, 0px));
  border-radius: var(--radius-xl, 20px) var(--radius-xl, 20px) 0 0;
  background: var(--color-white, #ffffff);
  border-top: 1px solid var(--color-border, #c5d0c8);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
  animation: responsive-sheet-slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  max-height: 90vh;
  overflow-y: auto;
}

.responsive-modal__card::before {
  content: '';
  display: block;
  width: 2.5rem;
  height: 0.25rem;
  border-radius: 999px;
  background: rgba(26, 46, 34, 0.2);
  margin: 0 auto var(--space-3, 0.75rem);
}

@keyframes responsive-sheet-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.responsive-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3, 0.75rem);
}

.responsive-modal__title {
  margin: 0;
  font-family: var(--font-display, "Outfit", sans-serif);
  font-size: var(--text-lg, 1.25rem);
  font-weight: 700;
  color: var(--color-ink, #1a2e22);
}

.responsive-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  min-height: var(--touch-min, 44px);
  min-width: var(--touch-min, 44px);
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--color-ink-muted, #5f7566);
  cursor: pointer;
}

.responsive-modal__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

/* Desktop: centered card modal */
@media (min-width: 641px) {
  .responsive-modal-root {
    justify-content: center;
    align-items: center;
    padding: var(--space-4, 1rem);
  }

  .responsive-modal__card {
    max-width: 480px;
    border-radius: var(--radius-xl, 18px);
    border: 1px solid var(--color-border, #c5d0c8);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
    padding: var(--space-5, 1.25rem);
    animation: responsive-card-scale-in 200ms ease-out forwards;
  }

  .responsive-modal__card::before {
    display: none;
  }

  @keyframes responsive-card-scale-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shared/responsiveSheetModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/ResponsiveSheetModal.tsx src/shared/ui/ResponsiveSheetModal.css tests/unit/shared/responsiveSheetModal.test.tsx
git commit -m "feat(ui): add reusable ResponsiveSheetModal bottom-sheet on mobile and centered card on desktop"
```

---

### Task 4: Move Status Pills into Timeline with "Update Status" Modal Form

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Test: `tests/unit/animals/animalDetailStatusInTimeline.test.tsx`

**Interfaces:**
- Consumes: `animal.status_id`, `statuses`, `setSingleStatusAssignment`
- Produces: Removed status pills from profile header; added "Update status" button in Timeline tab opening status form in `ResponsiveSheetModal`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailStatusInTimeline.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([
      { id: 'st-1', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
      { id: 'st-2', org_id: 'org-1', label: 'Quarantine', sort_order: 2, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
    writeTransaction: vi.fn().mockImplementation(async (cb) => cb({ execute: vi.fn() })),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalDetailScreen status moved inside Timeline tab', () => {
  it('does not render status pills in profile header; renders Update status button in Timeline tab that opens modal', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    // Header should NOT have status pills group
    expect(screen.queryByRole('group', { name: /Animal status/i })).toBeNull()

    // Switch to Timeline tab
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    // Button to update status exists
    const updateBtn = await screen.findByRole('button', { name: /Update status/i })
    expect(updateBtn).toBeInTheDocument()

    fireEvent.click(updateBtn)

    // Modal opens with status form
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Update status/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailStatusInTimeline.test.tsx`
Expected: FAIL (StatusSingleSelect still in header, no "Update status" button in Timeline)

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
1. Remove `<StatusSingleSelect ... />` from the profile header block above tabs.
2. Add state `const [showStatusModal, setShowStatusModal] = useState(false)`.
3. In the `Timeline` tab panel:
```tsx
        <div className="tab-panel" role="tabpanel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Status timeline</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowStatusModal(true)}
            >
              Update status
            </Button>
          </div>
          {/* Timeline entries */}
        </div>
```
4. Render `<ResponsiveSheetModal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update status">`:
```tsx
        <ResponsiveSheetModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update status"
        >
          <form className="stack" onSubmit={onSaveStatusForm}>
            <p className="section-label" style={{ margin: 0 }}>Select new status</p>
            <StatusSingleSelect
              statuses={statuses}
              value={statusId}
              onChange={(nextId) => setStatusId(nextId)}
              onAddStatus={() => setShowAddStatusModal(true)}
            />
            <TextField
              label="Effective date & time"
              type="datetime-local"
              value={statusEffectiveAt}
              onChange={(e) => setStatusEffectiveAt(e.target.value)}
            />
            <TextareaField
              label="Notes"
              hint="optional — reason for status change"
              rows={2}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="e.g. Cleared quarantine, moved to foster..."
            />
            <div className="row" style={{ marginTop: '0.5rem' }}>
              <Button type="submit" variant="primary">
                Save status
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowStatusModal(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </ResponsiveSheetModal>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailStatusInTimeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx tests/unit/animals/animalDetailStatusInTimeline.test.tsx
git commit -m "feat(animals): move status selection into Timeline tab with Update status modal form"
```

---

### Task 5: Refactor Timeline UI (Tags as Primary, Date/Time Secondary, Notes Optional)

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalDetailTimelineTagsPrimary.test.tsx`

**Interfaces:**
- Consumes: Timeline entries (`statusTreatments`, `arrivalTreatments`, `animal.intake_date`)
- Produces: Visual timeline with status tag badge prominent, timestamp secondary, and notes optional

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailTimelineTagsPrimary.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([
      { id: 'tr-st-1', animal_id: 'anim-1', treatment_type: 'status', notes: 'Checked by vet', treated_at: '2026-10-06T14:00:00Z' },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Timeline UI with tags as primary', () => {
  it('renders status tag badge as primary element, timestamp as secondary, and optional notes', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    const timelineItem = screen.getByText('Checked by vet').closest('.timeline-item')
    expect(timelineItem).toBeInTheDocument()
    // Status badge is rendered inside timeline item
    expect(timelineItem?.querySelector('.status-badge')).toBeInTheDocument()
    expect(timelineItem?.querySelector('.timeline-item__timestamp')).toBeInTheDocument()
    expect(timelineItem?.querySelector('.timeline-item__notes')).toHaveTextContent('Checked by vet')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailTimelineTagsPrimary.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
Render timeline item structure:
```tsx
        <div className="timeline-feed">
          {timelineTreatments.map((t) => {
            const label = t.notes?.trim() || animal.status_label || 'Status update'
            return (
              <div className="timeline-entry" key={t.id}>
                <div className="timeline-track">
                  <span className="timeline-dot" />
                </div>
                <div className="timeline-item">
                  <div className="timeline-item__primary">
                    <StatusBadge label={label} />
                  </div>
                  <div className="timeline-item__timestamp muted">
                    {t.treated_at ? formatCareTimestamp(t.treated_at) : 'Unknown date'}
                  </div>
                  {t.notes?.trim() && t.notes !== label ? (
                    <div className="timeline-item__notes">{t.notes}</div>
                  ) : null}
                </div>
              </div>
            )
          })}
          {/* Arrival milestone */}
          <div className="timeline-entry">
            <div className="timeline-track">
              <span className="timeline-dot timeline-dot--arrival" />
            </div>
            <div className="timeline-item">
              <div className="timeline-item__primary">
                <StatusBadge label="Arrived" tone="forest" />
              </div>
              <div className="timeline-item__timestamp muted">
                {animal.intake_date ? formatCareTimestamp(`${animal.intake_date}T12:00:00`) : 'Arrival'}
              </div>
            </div>
          </div>
        </div>
```

In `src/styles/global.css`:
```css
.timeline-feed {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 0.5rem;
}

.timeline-entry {
  display: flex;
  gap: var(--space-3, 0.75rem);
  position: relative;
  padding-bottom: var(--space-4, 1rem);
}

.timeline-entry::before {
  content: '';
  position: absolute;
  top: 1.25rem;
  bottom: 0;
  left: 0.55rem;
  width: 2px;
  background: var(--color-border, #c5d0c8);
}

.timeline-entry:last-child::before {
  display: none;
}

.timeline-track {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  padding-top: 0.25rem;
}

.timeline-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
  background: var(--color-forest, #2F5D3A);
  border: 2px solid var(--color-white, #ffffff);
  box-shadow: 0 0 0 1px var(--color-forest, #2F5D3A);
}

.timeline-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.timeline-item__primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.timeline-item__timestamp {
  font-size: var(--text-xs, 0.75rem);
  color: var(--color-ink-muted, #5f7566);
}

.timeline-item__notes {
  font-size: var(--text-sm, 0.875rem);
  color: var(--color-ink, #1a2e22);
  margin-top: 0.25rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailTimelineTagsPrimary.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx src/styles/global.css tests/unit/animals/animalDetailTimelineTagsPrimary.test.tsx
git commit -m "feat(animals): redesign timeline with tags as primary, timestamp secondary, and optional notes"
```

---

### Task 6: Wrap "Log Care" Form in `ResponsiveSheetModal`

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:580-640`
- Test: `tests/unit/animals/animalDetailCareModal.test.tsx`

**Interfaces:**
- Consumes: `showCareForm`, `treatmentType`, `notes`, `treatedAt`, `onSaveTreatment`
- Produces: Log care form rendered inside `ResponsiveSheetModal` (bottom sheet on mobile, centered card on desktop)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailCareModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Log care form in ResponsiveSheetModal', () => {
  it('opens care form in ResponsiveSheetModal dialog when Log care is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const logCareBtn = await screen.findByRole('button', { name: /Log care/i })
    fireEvent.click(logCareBtn)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Log care/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/What kind of care\?/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailCareModal.test.tsx`
Expected: FAIL (currently renders inline form panel, not in dialog modal)

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
Wrap the care form in `<ResponsiveSheetModal isOpen={showCareForm} onClose={resetCareForm} title={editingTreatmentId ? 'Edit care note' : 'Log care'}>`:
```tsx
      <ResponsiveSheetModal
        isOpen={showCareForm}
        onClose={resetCareForm}
        title={editingTreatmentId ? 'Edit care note' : 'Log care'}
      >
        <form className="stack" onSubmit={onSaveTreatment}>
          <SelectField
            label="What kind of care?"
            value={treatmentType}
            options={careFormTypes.map((key) => ({
              value: key,
              label: TREATMENT_LABELS[key],
            }))}
            onChange={(value) => setTreatmentType(value as TreatmentType)}
          />
          <TextField
            label="When"
            type="datetime-local"
            value={treatedAt}
            onChange={(e) => setTreatedAt(e.target.value)}
          />
          <TextareaField
            label="Notes"
            rows={3}
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was done, medicine given, next steps…"
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={hideFromPublic}
              onChange={(e) => setHideFromPublic(e.target.checked)}
            />
            <span>Hide from public</span>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row">
            <Button type="submit" variant="primary" disabled={!notes.trim()}>
              {editingTreatmentId ? 'Save changes' : 'Save care note'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCareForm}>
              Cancel
            </Button>
          </div>
        </form>
      </ResponsiveSheetModal>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailCareModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx tests/unit/animals/animalDetailCareModal.test.tsx
git commit -m "feat(animals): render Log care form in ResponsiveSheetModal"
```

---

### Task 7: Full Browser Verification (Mobile & Desktop)

**Files:**
- Test verification via headless Chrome mobile and desktop emulation

- [ ] **Step 1: Run full unit test suite and TypeScript check**
Run: `npm test -- --run && npx tsc --noEmit`
Expected: 100% tests pass, 0 errors.

- [ ] **Step 2: Capture screenshots on mobile and desktop viewports**
Verify:
1. Animal detail screen with aligned title, inline pencil, and `+ Daily Care` button.
2. Photo add button with `MedicalCrossIcon` (hospital cross).
3. Timeline tab with status badges as primary items and "Update status" button.
4. "Update status" opened as bottom sheet on mobile (Pixel 7).
5. "Update status" opened as centered card modal on desktop (1280px).
6. "Log care" opened as bottom sheet on mobile and centered card on desktop.
