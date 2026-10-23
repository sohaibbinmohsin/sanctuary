# Animal Cards, Detail Polish & Camera Retake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform animal grid cards into full-bleed photo cards with top/bottom shadow overlays, enforce a single status per animal, relocate the "Rescue details needed" callout into the animal meta slot, move the edit pencil inline next to the animal name with a word-based care checklist button, split care log and status milestones into Care and Timeline tabs, and fix the camera stream unmounting bug so retake photo works reliably.

**Architecture:** 
1. Redesign `AnimalCard` so that in grid mode the image occupies 100% of the card area with top status badge overlay and bottom title overlay against soft dark gradients.
2. Update status selection and assignment domain logic to enforce a single active status per animal.
3. Reposition the "Rescue details needed" banner on `AnimalDetailScreen` to replace the "Unknown" meta text directly underneath the animal title.
4. Position the edit button inline with the animal name/code, and replace the checklist icon button with a word-based status button (`+ Daily Care` / `In Daily Care`).
5. Introduce a 2-tab view on `AnimalDetailScreen` separating treatment notes (`Care` tab) from status changes and arrival milestones (`Timeline` tab).
6. Refactor `FieldCameraIntakeScreen` so `<video ref={videoRef}>` stays mounted during capture preview, preventing MediaStream disconnection during photo retakes.

**Tech Stack:** React 19, TypeScript, React Router 7, PowerSync / SQLite, Phosphor Icons, Vitest, Testing Library.

**Spec:** User feedback & design requests from 2026-10-05 session with reference image `media_1791205350168.jpg`.

## Global Constraints
- Light theme only, strictly adhering to Sanctuary design tokens (`--color-forest`, `--color-ink`, `--color-white`, `--font-display`, `--font-mono`).
- Outlined fonts: Outfit for display headers, DM Sans for body/controls, DM Mono for shelter codes.
- Touch targets >= 44px minimum touch area.
- No direct pushes to `main` under any circumstances; all work on dedicated feature branch `feature/camera-quick-intake`.
- Offline-first execution via PowerSync (`useDb` / `SanctuaryDb`).

---

### Task 1: Full-Bleed Animal Image Cards with Gradient Overlays (No White Space)

**Files:**
- Modify: `src/features/animals/components/AnimalCard.tsx:28-83`
- Modify: `src/styles/global.css:1866-2005`
- Test: `tests/unit/animals/animalCardGridFullBleed.test.tsx`

**Interfaces:**
- Consumes: `AnimalWithStatus`, `photoUrl`, `hasVerifiedPhoto`, `variant` from `AnimalCardProps`
- Produces: `AnimalCard` component rendering full-bleed photo cards in grid mode with top status badge overlay and bottom name overlay

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalCardGridFullBleed.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const baseAnimal: AnimalWithStatus = {
  id: 'anim-1',
  org_id: 'org-1',
  shelter_code: 'TS-001',
  name: 'Barnaby',
  species: 'Dog',
  sex: 'Male',
  markings: null,
  notes: null,
  archived: 0,
  intake_date: '2026-10-05',
  status_id: 'st-intake',
  status_label: 'Intake',
  status_labels: ['Intake'],
  created_at: '2026-10-05T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
}

describe('AnimalCard full-bleed grid layout', () => {
  it('renders top overlay with status tag and bottom overlay with name without separate card body', () => {
    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={baseAnimal} photoUrl="https://example.com/dog.jpg" hasVerifiedPhoto />
      </MemoryRouter>
    )

    const card = container.querySelector('.animal-card')
    expect(card).toHaveClass('animal-card--full-bleed')
    expect(container.querySelector('.animal-card__overlay-top')).toBeInTheDocument()
    expect(container.querySelector('.animal-card__overlay-bottom')).toBeInTheDocument()
    expect(screen.getByText('Intake')).toBeInTheDocument()
    expect(screen.getByText('Barnaby')).toBeInTheDocument()
    // Should NOT have the old separated white body
    expect(container.querySelector('.animal-card__body')).toBeNull()
  })

  it('renders full-bleed fallback gradient when no photo is present', () => {
    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={{ ...baseAnimal, name: null }} photoUrl={null} />
      </MemoryRouter>
    )

    expect(container.querySelector('.animal-card--no-photo')).toBeInTheDocument()
    expect(screen.getByText('TS-001')).toBeInTheDocument()
    expect(screen.getByText('Intake')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalCardGridFullBleed.test.tsx`
Expected: FAIL with `expect(card).toHaveClass('animal-card--full-bleed')`

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/components/AnimalCard.tsx`:
```tsx
export function AnimalCard({
  animal,
  photoUrl,
  hasVerifiedPhoto = false,
  variant = 'grid',
}: AnimalCardProps) {
  const primaryStatus = animal.status_label || animal.status_labels?.[0]
  const isList = variant === 'list'

  if (isList) {
    return (
      <Link className="animal-card animal-card--list" to={`/animals/${animal.id}`}>
        <div
          className="animal-card__photo"
          style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
          role={photoUrl ? 'img' : undefined}
          aria-label={photoUrl ? `Photo of ${animal.name || animal.shelter_code}` : undefined}
        >
          {photoUrl ? null : <span className="animal-card__photo-empty">No photo</span>}
          {hasVerifiedPhoto ? (
            <span className="animal-card__verified" title="Has a verified camera photo">
              <SealCheck size={14} weight="fill" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="animal-card__body">
          <div className={animal.name?.trim() ? 'animal-card__name' : 'animal-card__code shelter-code'}>
            {animal.name?.trim() || animal.shelter_code}
          </div>
          {animal.name?.trim() ? (
            <div className="animal-card__code shelter-code">{animal.shelter_code}</div>
          ) : null}
          {primaryStatus ? (
            <div className="status-badge-row">
              <StatusBadge label={primaryStatus} />
            </div>
          ) : null}
        </div>
      </Link>
    )
  }

  return (
    <Link
      className={`animal-card animal-card--full-bleed${!photoUrl ? ' animal-card--no-photo' : ''}`}
      to={`/animals/${animal.id}`}
      style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
      role="img"
      aria-label={`Photo card for ${animal.name || animal.shelter_code}`}
    >
      <div className="animal-card__overlay-top">
        {primaryStatus ? <StatusBadge label={primaryStatus} /> : <span />}
        {hasVerifiedPhoto ? (
          <span className="animal-card__verified-badge" title="Verified photo">
            <SealCheck size={14} weight="fill" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="animal-card__overlay-bottom">
        <span className="animal-card__overlay-title">
          {animal.name?.trim() || animal.shelter_code}
        </span>
        {animal.name?.trim() ? (
          <span className="animal-card__overlay-sub shelter-code">{animal.shelter_code}</span>
        ) : null}
      </div>
    </Link>
  )
}
```

In `src/styles/global.css`:
```css
.animal-card--full-bleed {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-lg, 14px);
  overflow: hidden;
  background-size: cover;
  background-position: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  background-color: var(--color-forest, #2F5D3A);
}

.animal-card--full-bleed.animal-card--no-photo {
  background: linear-gradient(145deg, #24482d 0%, #152d1d 100%);
}

.animal-card__overlay-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.65rem 1.4rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.25) 60%, transparent 100%);
  z-index: 1;
}

.animal-card__overlay-bottom {
  display: flex;
  flex-direction: column;
  padding: 1.4rem 0.65rem 0.65rem;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
  z-index: 1;
}

.animal-card__overlay-title {
  font-family: var(--font-display, "Outfit", sans-serif);
  font-size: var(--text-base, 1rem);
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.animal-card__overlay-sub {
  font-family: var(--font-mono, "DM Mono", monospace);
  font-size: var(--text-xs, 0.75rem);
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

.animal-card__verified-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: rgba(47, 93, 58, 0.9);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.35);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalCardGridFullBleed.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/components/AnimalCard.tsx src/styles/global.css tests/unit/animals/animalCardGridFullBleed.test.tsx
git commit -m "feat(animals): render full-bleed photo cards with top and bottom overlays in grid mode"
```

---

### Task 2: Single Status Enforcement (Replace Multi-Status)

**Files:**
- Modify: `src/features/animals/components/StatusMultiSelect.tsx`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:120-145,569-576`
- Modify: `src/features/animals/screens/AnimalIntakeScreen.tsx:357-363`
- Modify: `src/features/statuses/domain/assignments.ts`
- Test: `tests/unit/statuses/singleStatusSelection.test.tsx`

**Interfaces:**
- Consumes: `AnimalStatus[]`, `currentStatusId: string | null`, `onSelectStatus(statusId: string): void`
- Produces: Single active status pill selector ensuring only one status can be active at any time

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/statuses/singleStatusSelection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSingleSelect } from '@/features/animals/components/StatusSingleSelect'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

const mockStatuses: AnimalStatus[] = [
  { id: 'st-intake', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, is_default_arrival: 1, created_at: '', updated_at: '' },
  { id: 'st-foster', org_id: 'org-1', label: 'Foster', sort_order: 2, counts_as_in_care: 1, archived: 0, is_default_arrival: 0, created_at: '', updated_at: '' },
  { id: 'st-adopted', org_id: 'org-1', label: 'Adopted', sort_order: 3, counts_as_in_care: 0, archived: 0, is_default_arrival: 0, created_at: '', updated_at: '' },
]

describe('StatusSingleSelect', () => {
  it('allows selecting only one status at a time, switching when another is clicked', () => {
    const onSelect = vi.fn()
    render(
      <StatusSingleSelect
        statuses={mockStatuses}
        value="st-intake"
        onChange={onSelect}
      />
    )

    const intakePill = screen.getByRole('button', { name: /Intake/i })
    expect(intakePill).toHaveClass('is-selected')

    const fosterPill = screen.getByRole('button', { name: /Foster/i })
    fireEvent.click(fosterPill)

    expect(onSelect).toHaveBeenCalledWith('st-foster')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/statuses/singleStatusSelection.test.tsx`
Expected: FAIL with `Cannot find module '@/features/animals/components/StatusSingleSelect'`

- [ ] **Step 3: Implement minimal code**

Create `src/features/animals/components/StatusSingleSelect.tsx`:
```tsx
import type { AnimalStatus } from '@/features/statuses/domain/statuses'
import { Plus } from '@phosphor-icons/react'

type StatusSingleSelectProps = {
  statuses: AnimalStatus[]
  value: string | null
  onChange: (statusId: string) => void
  onAddStatus?: () => void
  disabled?: boolean
}

export function StatusSingleSelect({
  statuses,
  value,
  onChange,
  onAddStatus,
  disabled = false,
}: StatusSingleSelectProps) {
  const activeStatuses = statuses.filter((s) => s.archived === 0)

  return (
    <div className="status-single-select" role="group" aria-label="Animal status">
      <div className="status-pill-list">
        {activeStatuses.map((status) => {
          const selected = status.id === value
          return (
            <button
              key={status.id}
              type="button"
              className={`status-pill${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(status.id)}
              disabled={disabled}
              aria-pressed={selected}
            >
              {status.label}
            </button>
          )
        })}
        {onAddStatus ? (
          <button
            type="button"
            className="status-pill status-pill--add"
            onClick={onAddStatus}
            disabled={disabled}
            aria-label="Add new status"
          >
            <Plus size={14} weight="bold" /> Add
          </button>
        ) : null}
      </div>
    </div>
  )
}
```

In `src/features/statuses/domain/assignments.ts`, add:
```ts
export async function setSingleStatusAssignment(
  db: SanctuaryDb,
  input: { animalId: string; orgId: string; statusId: string }
): Promise<void> {
  const now = new Date().toISOString()
  await db.execute('DELETE FROM animal_status_assignments WHERE animal_id = ?', [input.animalId])
  await db.execute(
    'INSERT INTO animal_status_assignments (id, animal_id, status_id, assigned_at) VALUES (?, ?, ?, ?)',
    [`asa-${crypto.randomUUID()}`, input.animalId, input.statusId, now]
  )
  await db.execute(
    'UPDATE animals SET status_id = ?, updated_at = ? WHERE id = ?',
    [input.statusId, now, input.animalId]
  )
}
```

Wire `StatusSingleSelect` into `AnimalDetailScreen.tsx` and `AnimalIntakeScreen.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/statuses/singleStatusSelection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/components/StatusSingleSelect.tsx src/features/statuses/domain/assignments.ts src/features/animals/screens/AnimalDetailScreen.tsx src/features/animals/screens/AnimalIntakeScreen.tsx tests/unit/statuses/singleStatusSelection.test.tsx
git commit -m "feat(statuses): enforce single active status per animal with StatusSingleSelect"
```

---

### Task 3: Relocate "Rescue details needed" Card to the Unknown Meta Slot

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:507-567`
- Test: `tests/unit/animals/animalDetailRescueNeededPlacement.test.tsx`

**Interfaces:**
- Consumes: `animal.species === 'Unknown'`, `animal.id`
- Produces: Repositioned Rescue details needed card rendered beneath the animal title row instead of at the top of the screen

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailRescueNeededPlacement.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'stub-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: null,
      species: 'Unknown',
      sex: null,
      markings: null,
      notes: null,
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
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

describe('Rescue details needed placement on AnimalDetailScreen', () => {
  it('renders Rescue details needed card below the animal title, not above it', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/animals/stub-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const title = await screen.findByRole('heading', { level: 1, name: 'MS-0001' })
    const stubCard = await screen.findByText('Rescue details needed')

    // Document position check: title must precede stubCard in DOM
    expect(title.compareDocumentPosition(stubCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // "Unknown" text should not be rendered
    expect(screen.queryByText('Unknown')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailRescueNeededPlacement.test.tsx`
Expected: FAIL (currently the stub card precedes the title)

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
Move the `stub-callout` from before `detail-hero__id-row` to the slot right beneath it:
```tsx
          <div>
            <div className="detail-hero__id-row">
              <h1 className={animal.name?.trim() ? 'detail-hero__title' : 'detail-hero__title shelter-code'}>
                {animal.name?.trim() || animal.shelter_code}
              </h1>
              {/* inline edit pencil and action button */}
            </div>
            {animal.name?.trim() ? (
              <p className="detail-hero__title shelter-code">{animal.shelter_code}</p>
            ) : null}
          </div>

          {animal.species === 'Unknown' ? (
            <div className="stub-callout">
              <div className="stub-callout__header">
                <strong className="stub-callout__title">Rescue details needed</strong>
                <Link to={`/animals/${animal.id}/edit`} className="stub-callout__btn">
                  Add
                </Link>
              </div>
              <p className="stub-callout__body">
                This animal was saved during quick field intake.
              </p>
            </div>
          ) : detailMeta ? (
            <p className="muted" style={{ margin: 0 }}>
              {detailMeta}
            </p>
          ) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailRescueNeededPlacement.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx tests/unit/animals/animalDetailRescueNeededPlacement.test.tsx
git commit -m "feat(animals): render Rescue details needed card in meta slot below title on detail screen"
```

---

### Task 4: Move Edit Pencil Inline & Word Button for Daily Care Checklist

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:522-555`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalDetailActionsWordButton.test.tsx`

**Interfaces:**
- Consumes: `onChecklist: boolean`, `onToggleChecklist(): Promise<void>`
- Produces: Inline edit pencil next to title and word-based daily care button: `+ Daily Care` (inactive) / `In Daily Care` (active)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailActionsWordButton.test.tsx
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
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
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

describe('Inline edit and word-based Daily Care button', () => {
  it('renders inline edit pencil and "+ Daily Care" word button when not on checklist', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const editBtn = await screen.findByRole('link', { name: /Edit animal/i })
    expect(editBtn).toBeInTheDocument()

    const careBtn = await screen.findByRole('button', { name: /\+ Daily Care/i })
    expect(careBtn).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailActionsWordButton.test.tsx`
Expected: FAIL with `Unable to find an accessible element with the role "button" and name /\+ Daily Care/i`

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
```tsx
            <div className="detail-hero__id-row">
              <div className="detail-hero__title-wrap">
                <h1 className={animal.name?.trim() ? 'detail-hero__title' : 'detail-hero__title shelter-code'}>
                  {animal.name?.trim() || animal.shelter_code}
                </h1>
                <Button
                  to={`/animals/${animal.id}/edit`}
                  variant="ghost"
                  className="btn--icon btn--inline-edit"
                  aria-label="Edit animal"
                  title="Edit"
                >
                  <PencilSimple size={18} weight="bold" aria-hidden />
                </Button>
              </div>

              {member ? (
                <button
                  type="button"
                  className={`animal-daily-care-btn${onChecklist ? ' is-active' : ''}`}
                  disabled={checklistBusy}
                  onClick={() => void onToggleChecklist()}
                  aria-label={onChecklist ? 'Remove from Daily Care' : 'Add to Daily Care'}
                >
                  {onChecklist ? (
                    <>
                      <CheckCircle size={16} weight="fill" /> In Daily Care
                    </>
                  ) : (
                    '+ Daily Care'
                  )}
                </button>
              ) : null}
            </div>
```

In `src/styles/global.css`:
```css
.detail-hero__title-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.btn--inline-edit {
  width: 2.25rem !important;
  height: 2.25rem !important;
  min-height: 2.25rem !important;
  padding: 0 !important;
  border-radius: 999px;
  color: var(--color-ink-muted);
}

.animal-daily-care-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-body, "DM Sans", sans-serif);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  min-height: 38px;
  border-radius: 999px;
  border: 1px solid var(--color-forest, #2F5D3A);
  background: transparent;
  color: var(--color-forest, #2F5D3A);
  cursor: pointer;
  transition: all var(--duration) var(--ease-out);
}

.animal-daily-care-btn.is-active {
  background: var(--color-forest, #2F5D3A);
  color: #ffffff;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailActionsWordButton.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx src/styles/global.css tests/unit/animals/animalDetailActionsWordButton.test.tsx
git commit -m "feat(animals): place edit pencil inline with name and use word button for daily care"
```

---

### Task 5: Tabbed Interface: Care Tab vs. Timeline Tab

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:578-730`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalDetailTabs.test.tsx`

**Interfaces:**
- Consumes: `activeTab: 'care' | 'timeline'`
- Produces: Two distinct tabs on animal details: Care tab (care treatments & notes) and Timeline tab (status transitions & arrival)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/animalDetailTabs.test.tsx
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
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([
      { id: 'tr-1', animal_id: 'anim-1', treatment_type: 'medication', notes: 'Given antibiotic', treated_at: '2026-10-05T10:00:00Z' },
      { id: 'tr-2', animal_id: 'anim-1', treatment_type: 'status', notes: 'Moved to foster', treated_at: '2026-10-05T09:00:00Z' },
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

describe('Care and Timeline tabs on AnimalDetailScreen', () => {
  it('switches between Care tab and Timeline tab, showing respective entries', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const careTab = await screen.findByRole('tab', { name: /Care/i })
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    expect(careTab).toBeInTheDocument()
    expect(timelineTab).toBeInTheDocument()

    // Default Care tab: shows medication note and Log care button
    expect(screen.getByText('Given antibiotic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log care/i })).toBeInTheDocument()
    expect(screen.queryByText('Moved to foster')).toBeNull()

    // Switch to Timeline tab: shows status change
    fireEvent.click(timelineTab)
    expect(screen.getByText('Moved to foster')).toBeInTheDocument()
    expect(screen.queryByText('Given antibiotic')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalDetailTabs.test.tsx`
Expected: FAIL with `Unable to find an accessible element with the role "tab" and name /Care/i`

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
Add tab state:
```tsx
const [activeTab, setActiveTab] = useState<'care' | 'timeline'>('care')
```
Separate treatments:
```tsx
const careTreatments = treatments.filter((t) => t.treatment_type !== 'status')
const timelineTreatments = treatments.filter((t) => t.treatment_type === 'status')
```
Render tabs:
```tsx
      <div className="tab-group" role="tablist" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'care'}
          className={`tab-btn${activeTab === 'care' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('care')}
        >
          Care
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeline'}
          className={`tab-btn${activeTab === 'timeline' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'care' ? (
        <div className="tab-panel" role="tabpanel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Care log</h2>
            {!showCareForm && (
              <Button type="button" variant="secondary" onClick={openCreateCareForm}>
                Log care
              </Button>
            )}
          </div>
          {/* Care form and care notes list */}
        </div>
      ) : (
        <div className="tab-panel" role="tabpanel">
          <h2 style={{ margin: 0, marginBottom: '0.75rem' }}>Status timeline</h2>
          {/* Timeline entries and Arrival */}
        </div>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalDetailTabs.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx src/styles/global.css tests/unit/animals/animalDetailTabs.test.tsx
git commit -m "feat(animals): separate status timeline and care logs into dedicated tabs on detail screen"
```

---

### Task 6: Fix Camera Retake Stream Unmounting Bug

**Files:**
- Modify: `src/features/animals/screens/FieldCameraIntakeScreen.tsx:208-227`
- Test: `tests/unit/animals/fieldCameraRetakeStream.test.tsx`

**Interfaces:**
- Consumes: `<video ref={videoRef}>`, `capturedPreview`, `handleRetake()`
- Produces: Continuously mounted `<video>` sink ensuring retaking photos keeps the live camera feed active

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/animals/fieldCameraRetakeStream.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FieldCameraIntakeScreen } from '@/features/animals/screens/FieldCameraIntakeScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    getOptional: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test Shelter' },
    loading: false,
  }),
}))

describe('FieldCameraIntakeScreen retake video stream preservation', () => {
  beforeEach(() => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb) => {
      cb(new Blob(['fake'], { type: 'image/jpeg' }))
    })
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('keeps video element mounted when photo is captured and when retake is clicked', async () => {
    const { container } = render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>
    )

    const videoEl = container.querySelector('video')
    expect(videoEl).toBeInTheDocument()

    // Capture photo
    const shutter = screen.getByLabelText(/Take verified photo/i)
    fireEvent.click(shutter)

    // Confirm sheet is open
    expect(await screen.findByText('Photo captured')).toBeInTheDocument()

    // Video must still be in the DOM (not unmounted!)
    expect(container.querySelector('video')).toBeInTheDocument()

    // Click Retake photo
    const retakeBtn = screen.getByRole('button', { name: /Retake photo/i })
    fireEvent.click(retakeBtn)

    // Video is still the same element and ready
    expect(container.querySelector('video')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/fieldCameraRetakeStream.test.tsx`
Expected: FAIL because `<video>` is currently replaced with `<div className="camera-overlay__video" ...>` when `capturedPreview` is truthy.

- [ ] **Step 3: Implement minimal code**

In `src/features/animals/screens/FieldCameraIntakeScreen.tsx`:
Keep `<video>` permanently mounted in the DOM, and overlay the freeze frame on top when previewing:
```tsx
        {/* Always keep video element mounted so MediaStream connection is never broken */}
        <video
          ref={videoRef}
          className="camera-overlay__video"
          autoPlay
          playsInline
          muted
        />

        {capturedPreview ? (
          <div
            className="camera-overlay__video camera-overlay__video-freeze"
            style={{
              backgroundImage: `url(${capturedPreview})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : null}
```

In `handleRetake()`:
```tsx
  function handleRetake() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCapturedBlob(null)
    setCapturedPreview(null)
    setShowConfirm(false)
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }
```

In `FieldCameraIntakeScreen.css`:
```css
.camera-overlay__video-freeze {
  position: absolute;
  inset: 0;
  z-index: 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/fieldCameraRetakeStream.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/screens/FieldCameraIntakeScreen.tsx src/features/animals/screens/FieldCameraIntakeScreen.css tests/unit/animals/fieldCameraRetakeStream.test.tsx
git commit -m "fix(camera): preserve video element across capture and retake cycles"
```

---

### Task 7: Full Browser Subagent Verification

**Files:**
- Test verification via `/browser` subagent / headless Chrome mobile emulation

- [ ] **Step 1: Run complete test suite**
Run: `npm test -- --run && npx tsc --noEmit`
Expected: 0 errors, 100% test pass.

- [ ] **Step 2: Browser Verification**
Launch Chrome / browser subagent on `/playground/animals/camera` and `/animals/:id` to verify:
1. Full-bleed animal cards in grid view with top/bottom shadow gradients and high-contrast typography.
2. Single-status pill selection on animal details.
3. Repositioned "Rescue details needed" banner below the title in place of "Unknown".
4. Inline edit pencil and word-based `+ Daily Care` button.
5. Functional Care and Timeline tabs.
6. Taking and retaking photos without black screens.
Take mobile screenshots to verify all visual criteria.
