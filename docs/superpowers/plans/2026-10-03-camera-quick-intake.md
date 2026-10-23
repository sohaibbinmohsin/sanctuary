# Camera Quick Intake & Animal Stubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable rapid field triage by opening a full-screen camera intake on mobile devices when tapping "Add animal", allowing caregivers to capture verified rescue photos and immediately save an animal stub ("Add details later") to snap the next animal, or proceed directly to entering details ("Add details now"). Desktop continues straight to the full intake form.

**Architecture:** Route `/animals/camera` hosts `FieldCameraIntakeScreen`. When tapping "Add animal", `AnimalsListScreen` branches: mobile / touch devices with camera support (`canTakePhoto`) route to `/animals/camera`, while desktop routes to `/animals/new`. Capturing a photo presents Sanctuary's Confirm Card dialog where users can choose "Add details later" (creates animal stub with sequential shelter code and `species = 'Unknown'`, mints verified photo session, queues photo, shows morale toast, and resets camera for the next animal) or "Add details now" (creates animal stub with photo and navigates to `/animals/:id/edit`). Animals list and detail views render clear "Add details" indicators for stubs.

**Tech Stack:** React 19, TypeScript, React Router 7, PowerSync (SQLite WASM), Supabase (Auth, Postgres, Edge Functions for capture-session & R2 signing), Lucide / Phosphor Icons (`@phosphor-icons/react`), Vitest, Testing Library.

**Spec:** [Interactive Camera Intake Prototype](file:///home/ubuntu/development/sanctuary/public/prototype.html) and approved user decisions in conversation transcript (session 2026-10-03).

## Global Constraints

- Strictly adhere to Sanctuary's light-only design system (`design-system/sanctuary/MASTER.md` and `src/styles/tokens.css`): Forest `#2F5D3A`, Forest soft `#E8EFEA`, Surface `#F7F8F5`, Mist `#E5E8E1`, Ink `#1A2E22`, Muted Ink `#4A584E`.
- Outlined fonts: Outfit for display headers, DM Sans for body/controls, DM Mono for shelter codes.
- No dark mode. Touch targets >= 44px minimum touch area.
- No direct pushes to `main` under any circumstances (per user git rules).
- All queries and mutations must support offline-first execution via PowerSync (`SanctuaryDb`).

---

### Task 1: Domain Helper for Quick Animal Stub & Shelter Code Preview

**Files:**
- Modify: `src/features/animals/domain/animals.ts:1-120`
- Test: `tests/unit/animals/createQuickAnimalStub.test.ts`

**Interfaces:**
- Consumes:
  - `SanctuaryDb` from `@/shared/lib/db`
  - `nextShelterId` from `@/shared/lib/ids/shelterId`
  - `createAnimal`, `getAnimal` from `@/features/animals/domain/animals`
  - `listStatuses` from `@/features/statuses/domain/statuses`
  - `queuePhoto` from `@/features/photos/domain/photos`
  - `requestCaptureSession` from `@/shared/lib/r2/captureSession`
- Produces:
  - `getNextShelterCode(db: SanctuaryDb, orgId: string, prefix: string): Promise<string>`
  - `createQuickAnimalStub(db: SanctuaryDb, input: CreateQuickAnimalStubInput): Promise<{ animal: AnimalRecord; shelterCode: string }>`

- [ ] **Step 1: Write the failing test for `getNextShelterCode` and `createQuickAnimalStub`**

Create `tests/unit/animals/createQuickAnimalStub.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import {
  getNextShelterCode,
  createQuickAnimalStub,
} from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

function createMockDb(): SanctuaryDb {
  const tables: Record<string, any[]> = {
    animals: [
      { id: '1', org_id: 'org-1', shelter_code: 'TS-001', species: 'Dog' },
      { id: '2', org_id: 'org-1', shelter_code: 'TS-002', species: 'Cat' },
    ],
    animal_statuses: [
      { id: 'st-1', org_id: 'org-1', name: 'Intake', counts_as_in_care: 1, sort_order: 1 },
      { id: 'st-2', org_id: 'org-1', name: 'Adopted', counts_as_in_care: 0, sort_order: 2 },
    ],
    treatments: [],
    animal_status_assignments: [],
    photos: [],
    local_photo_cache: [],
  }

  return {
    async getAll<T>(query: string, params: any[] = []): Promise<T[]> {
      if (query.includes('FROM animals WHERE org_id = ?')) {
        return tables.animals.filter((a) => a.org_id === params[0]) as T[]
      }
      if (query.includes('FROM animal_statuses WHERE org_id = ?')) {
        return tables.animal_statuses.filter((s) => s.org_id === params[0]) as T[]
      }
      return []
    },
    async get<T>(query: string, params: any[] = []): Promise<T | null> {
      if (query.includes('FROM animals WHERE id = ?')) {
        return (tables.animals.find((a) => a.id === params[0]) ?? null) as T | null
      }
      return null
    },
    async execute(query: string, params: any[] = []): Promise<void> {
      if (query.includes('INSERT INTO animals')) {
        tables.animals.push({
          id: params[0],
          org_id: params[1],
          shelter_code: params[2],
          name: params[3],
          species: params[4],
          sex: params[5],
          markings: params[6],
          intake_date: params[7],
          status_id: params[8],
          notes: params[9],
          created_at: params[10],
          updated_at: params[11],
        })
      } else if (query.includes('INSERT INTO photos')) {
        tables.photos.push({ id: params[0], org_id: params[1], animal_id: params[2] })
      }
    },
    async executeTransaction(fn: (tx: any) => Promise<void>): Promise<void> {
      return fn(this)
    },
  } as unknown as SanctuaryDb
}

describe('Quick Animal Stub Domain', () => {
  it('predicts the next sequential shelter code correctly', async () => {
    const db = createMockDb()
    const nextCode = await getNextShelterCode(db, 'org-1', 'TS')
    expect(nextCode).toBe('TS-003')
  })

  it('creates an animal stub with Unknown species and in-care status', async () => {
    const db = createMockDb()
    const dummyBlob = new Blob(['mock-photo'], { type: 'image/jpeg' })

    const result = await createQuickAnimalStub(db, {
      orgId: 'org-1',
      prefix: 'TS',
      photoBlob: dummyBlob,
      captureSource: 'camera',
    })

    expect(result.shelterCode).toBe('TS-003')
    expect(result.animal.species).toBe('Unknown')
    expect(result.animal.shelter_code).toBe('TS-003')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/createQuickAnimalStub.test.ts`
Expected: FAIL with `getNextShelterCode` and `createQuickAnimalStub` are not exported.

- [ ] **Step 3: Implement `getNextShelterCode` and `createQuickAnimalStub` in `src/features/animals/domain/animals.ts`**

In `src/features/animals/domain/animals.ts`, add:
```typescript
import { listStatuses } from '@/features/statuses/domain/statuses'
import { queuePhoto } from '@/features/photos/domain/photos'

export type CreateQuickAnimalStubInput = {
  orgId: string
  prefix: string
  photoBlob?: Blob
  captureSource?: 'camera' | 'gallery'
  captureToken?: string
  statusId?: string
}

export async function getNextShelterCode(
  db: SanctuaryDb,
  orgId: string,
  prefix: string,
): Promise<string> {
  const codes = await db.getAll<{ shelter_code: string }>(
    `SELECT shelter_code FROM animals WHERE org_id = ?`,
    [orgId],
  )
  return nextShelterId(
    prefix,
    codes.map((c) => c.shelter_code),
  )
}

export async function createQuickAnimalStub(
  db: SanctuaryDb,
  input: CreateQuickAnimalStubInput,
): Promise<{ animal: AnimalRecord; shelterCode: string }> {
  let statusId = input.statusId
  if (!statusId) {
    const statuses = await listStatuses(db, input.orgId)
    const inCare = statuses.find((s) => s.counts_as_in_care === 1 && !s.archived)
    statusId = inCare ? inCare.id : statuses[0]?.id
  }

  if (!statusId) {
    throw new Error('No animal status found to assign.')
  }

  const animal = await createAnimal(db, {
    orgId: input.orgId,
    prefix: input.prefix,
    species: 'Unknown',
    statusIds: [statusId],
    name: undefined,
    sex: undefined,
    markings: undefined,
  })

  if (input.photoBlob) {
    await queuePhoto(db, {
      orgId: input.orgId,
      animalId: animal.id,
      blob: input.photoBlob,
      captureSource: input.captureSource ?? 'camera',
      captureToken: input.captureToken,
    })
  }

  return {
    animal,
    shelterCode: animal.shelter_code,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/createQuickAnimalStub.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/animals/domain/animals.ts tests/unit/animals/createQuickAnimalStub.test.ts
git commit -m "feat(animals): add getNextShelterCode and createQuickAnimalStub domain helpers"
```

---

### Task 2: Route & Entry Point Branching (Mobile Camera vs Desktop Form)

**Files:**
- Modify: `src/features/animals/screens/AnimalsListScreen.tsx:200-295`
- Modify: `src/app/router.tsx:160-185`
- Test: `tests/unit/animals/animalsListScreenRouting.test.tsx`

**Interfaces:**
- Consumes:
  - `useCanTakePhoto` from `@/shared/hooks/useCanTakePhoto`
- Produces:
  - Dynamic navigation on "Add animal": `/animals/camera` if mobile/touch device with camera, else `/animals/new`.
  - Route `/animals/camera` in `AppShell` rendering `FieldCameraIntakeScreen`.

- [ ] **Step 1: Write the failing test for "Add animal" route selection**

Create `tests/unit/animals/animalsListScreenRouting.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import * as canTakeModule from '@/shared/hooks/useCanTakePhoto'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test' },
    loading: false,
  }),
}))

vi.mock('@/shared/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'connected', pendingCount: 0 }),
}))

vi.mock('@powersync/react', () => ({
  useQuery: () => ({ data: [{ n: 1 }] }),
}))

describe('AnimalsListScreen "Add animal" button target', () => {
  it('links to /animals/camera on mobile devices with camera support', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addButtons = screen.getAllByRole('link', { name: /add animal/i })
    expect(addButtons[0]).toHaveAttribute('href', '/animals/camera')
  })

  it('links to /animals/new on desktop browsers without camera support', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(false)

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addButtons = screen.getAllByRole('link', { name: /add animal/i })
    expect(addButtons[0]).toHaveAttribute('href', '/animals/new')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalsListScreenRouting.test.tsx`
Expected: FAIL because `AnimalsListScreen` hardcodes `/animals/new`.

- [ ] **Step 3: Update `AnimalsListScreen.tsx` to branch based on `useCanTakePhoto`**

In `src/features/animals/screens/AnimalsListScreen.tsx`:
Import `useCanTakePhoto`:
```typescript
import { useCanTakePhoto } from '@/shared/hooks/useCanTakePhoto'
```
In `AnimalsListScreen()`:
```typescript
const canTakePhoto = useCanTakePhoto()
const addAnimalTarget = canTakePhoto ? '/animals/camera' : '/animals/new'
```
Replace `/animals/new` references for adding animals with `addAnimalTarget`:
- PageHeader actions `to={addAnimalTarget}`
- EmptyState `actionTo={hasFilters ? undefined : addAnimalTarget}`

In `src/app/router.tsx`:
Add route for `/animals/camera`:
```typescript
<Route path="/animals/camera" element={<FieldCameraIntakeScreen />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalsListScreenRouting.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/animals/screens/AnimalsListScreen.tsx src/app/router.tsx tests/unit/animals/animalsListScreenRouting.test.tsx
git commit -m "feat(animals): route Add animal to /animals/camera on mobile devices"
```

---

### Task 3: Build `FieldCameraIntakeScreen` Matching Approved Prototype

**Files:**
- Create: `src/features/animals/screens/FieldCameraIntakeScreen.tsx`
- Create: `src/features/animals/screens/FieldCameraIntakeScreen.css`
- Modify: `src/app/router.tsx`
- Test: `tests/unit/animals/fieldCameraIntakeScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `useDb` from `@/shared/hooks/useDb`
  - `useCurrentMember` from `@/shared/hooks/useCurrentMember`
  - `createQuickAnimalStub`, `getNextShelterCode` from `@/features/animals/domain/animals`
  - `requestCaptureSession` from `@/shared/lib/r2/captureSession`
  - `processPhotoQueue` from `@/features/photos/domain/photos`
- Produces:
  - `FieldCameraIntakeScreen` component rendering:
    - Viewfinder stream with `<video>` and reticle.
    - Top bar: Close `(X)` to `/animals`, "Skip to form" to `/animals/new`.
    - Shutter button to snap a photo.
    - Review Confirm Card modal matching the approved prototype:
      - Title: "Photo captured" (centered, first item above header).
      - Header: `shelter-code` and `verified-badge` with icon.
      - "Add details later" (Primary button): creates animal stub with photo, shows Morale Toast (`TS-015 saved · Ready for next animal`), resets camera for next intake.
      - "Add details now →" (Secondary button): creates animal stub with photo, navigates to `/animals/:id/edit`.
      - "Retake photo" (Ghost button): clears capture and resumes live camera.

- [ ] **Step 1: Write the failing test for `FieldCameraIntakeScreen`**

Create `tests/unit/animals/fieldCameraIntakeScreen.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FieldCameraIntakeScreen } from '@/features/animals/screens/FieldCameraIntakeScreen'
import * as animalsDomain from '@/features/animals/domain/animals'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test Shelter' },
    loading: false,
  }),
}))

describe('FieldCameraIntakeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(animalsDomain, 'getNextShelterCode').mockResolvedValue('TS-015')
    vi.spyOn(animalsDomain, 'createQuickAnimalStub').mockResolvedValue({
      animal: {
        id: 'new-animal-123',
        org_id: 'org-1',
        shelter_code: 'TS-015',
        species: 'Unknown',
        archived: 0,
        intake_date: '2026-10-03',
        status_id: 'st-1',
        created_at: '2026-10-03T00:00:00Z',
        updated_at: '2026-10-03T00:00:00Z',
      },
      shelterCode: 'TS-015',
    })
  })

  it('renders camera controls, close button, and skip to form button', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /close camera/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip to form/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /take verified photo/i })).toBeInTheDocument()
  })

  it('navigates to /animals/new when clicking Skip to form', () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /skip to form/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/animals/new')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/fieldCameraIntakeScreen.test.tsx`
Expected: FAIL because `FieldCameraIntakeScreen` does not exist yet.

- [ ] **Step 3: Create `FieldCameraIntakeScreen.tsx` and `FieldCameraIntakeScreen.css`**

Create `src/features/animals/screens/FieldCameraIntakeScreen.css`:
Port the CSS rules directly from the approved prototype (`public/prototype.html`), including `.camera-overlay`, `.camera-overlay__top`, `.camera-overlay__close`, `.camera-overlay__skip`, `.camera-overlay__viewfinder`, `.camera-overlay__shutter`, `.confirm-card`, `.confirm-card__title`, `.confirm-card__header`, `.shelter-code`, `.verified-badge`, `.confirm-card__actions`, and `.morale-toast`.

Create `src/features/animals/screens/FieldCameraIntakeScreen.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, SealCheck, X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  createQuickAnimalStub,
  getNextShelterCode,
} from '@/features/animals/domain/animals'
import { requestCaptureSession } from '@/shared/lib/r2/captureSession'
import { processPhotoQueue } from '@/features/photos/domain/photos'
import { isPlaygroundMode } from '@/features/playground/mode'
import { Button } from '@/shared/ui/Button'
import './FieldCameraIntakeScreen.css'

export function FieldCameraIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [streamReady, setStreamReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)
  const [predictedCode, setPredictedCode] = useState<string>('...')
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Initialize camera stream
  useEffect(() => {
    let cancelled = false

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStreamReady(true)
      } catch (err) {
        if (!cancelled) {
          setCameraError('Could not access camera. Please check camera permissions.')
        }
      }
    }

    void initCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Load next shelter code
  useEffect(() => {
    if (!db || !member) return
    void getNextShelterCode(db, member.orgId, member.orgInitials).then(setPredictedCode)
  }, [db, member])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !streamReady || saving) return

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 960
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          setCapturedBlob(blob)
          setCapturedPreview(URL.createObjectURL(blob))
          setShowConfirm(true)
        },
        'image/jpeg',
        0.88,
      )
    } catch (e) {
      console.error('Failed to capture frame', e)
    }
  }

  function handleRetake() {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview)
    }
    setCapturedBlob(null)
    setCapturedPreview(null)
    setShowConfirm(false)
  }

  async function handleSave(mode: 'later' | 'now') {
    if (!db || !member || !capturedBlob || saving) return
    setSaving(true)

    try {
      // 1. Create animal stub
      const { animal, shelterCode } = await createQuickAnimalStub(db, {
        orgId: member.orgId,
        prefix: member.orgInitials,
        photoBlob: capturedBlob,
        captureSource: 'camera',
      })

      // 2. If online and not playground, mint verified session
      if (navigator.onLine && !isPlaygroundMode()) {
        try {
          const session = await requestCaptureSession({ animalId: animal.id })
          // photo queue will bind session token on background sync
        } catch (err) {
          console.warn('Verified session mint error (saved as unverified camera capture):', err)
        }
        void processPhotoQueue(db)
      }

      if (mode === 'later') {
        // Show morale toast, refresh next code, and reset camera for next animal
        setToastMessage(`${shelterCode} saved · Ready for next animal`)
        handleRetake()
        void getNextShelterCode(db, member.orgId, member.orgInitials).then(setPredictedCode)
        setTimeout(() => setToastMessage(null), 3200)
      } else {
        // Navigate straight to edit details
        navigate(`/animals/${animal.id}/edit`)
      }
    } catch (err) {
      console.error('Failed to save quick animal stub', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="camera-intake-screen">
      {/* Viewfinder stream */}
      <div className="camera-overlay">
        {capturedPreview ? (
          <div
            className="camera-overlay__video"
            style={{
              backgroundImage: `url(${capturedPreview})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <video
            ref={videoRef}
            className="camera-overlay__video"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Top Bar */}
        <div className="camera-overlay__top">
          <button
            type="button"
            className="camera-overlay__close"
            onClick={() => navigate('/animals')}
            aria-label="Close camera"
          >
            <X size={20} weight="bold" />
          </button>
          <button
            type="button"
            className="camera-overlay__skip"
            onClick={() => navigate('/animals/new')}
          >
            Skip to form
          </button>
        </div>

        {/* Center reticle */}
        <div className="camera-overlay__viewfinder" />

        {/* Shutter controls */}
        {!showConfirm && (
          <div className="camera-overlay__controls">
            <button
              type="button"
              className="camera-overlay__shutter"
              onClick={handleCapture}
              disabled={!streamReady || saving}
              aria-label="Take verified photo"
            >
              <div className="camera-overlay__shutter-inner" />
            </button>
          </div>
        )}
      </div>

      {/* Review Dialog matching approved prototype */}
      {showConfirm && (
        <div className="confirm-root is-active" role="dialog" aria-modal="true">
          <div className="confirm-backdrop" onClick={handleRetake} />
          <div className="confirm-card">
            <h2 className="confirm-card__title">Photo captured</h2>

            {/* Image Card with Tag and ID on it */}
            <div className="confirm-image-card">
              <div
                className="confirm-image-card__img"
                style={
                  capturedPreview
                    ? { backgroundImage: `url(${capturedPreview})` }
                    : undefined
                }
              />
              <div className="confirm-image-card__overlay">
                <span className="shelter-code">{predictedCode}</span>
                <span className="verified-badge">
                  <SealCheck size={14} weight="fill" />
                  Verified photo
                </span>
              </div>
            </div>

            <div className="confirm-card__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => handleSave('later')}
                disabled={saving}
              >
                {saving ? 'Saving stub…' : 'Add details later'}
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={() => handleSave('now')}
                disabled={saving}
              >
                Add details now →
              </button>

              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={handleRetake}
                disabled={saving}
              >
                Retake photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Morale Toast */}
      {toastMessage && (
        <div className="morale-toast is-visible" role="status">
          <CheckCircle size={16} weight="fill" color="#6EE7B7" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/fieldCameraIntakeScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/animals/screens/FieldCameraIntakeScreen.tsx src/features/animals/screens/FieldCameraIntakeScreen.css tests/unit/animals/fieldCameraIntakeScreen.test.tsx
git commit -m "feat(animals): build FieldCameraIntakeScreen matching approved prototype"
```

---

### Task 4: Animal Card & Intake Polish for Stubs (`species === 'Unknown'`)

**Files:**
- Modify: `src/features/animals/components/AnimalCard.tsx:50-80`
- Modify: `src/features/animals/screens/AnimalIntakeScreen.tsx:30-45`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:505-535`
- Test: `tests/unit/animals/animalCardStub.test.tsx`

**Interfaces:**
- Consumes:
  - `AnimalWithStatus` from `@/features/animals/domain/animals`
- Produces:
  - Visual "Add details" indicator on `AnimalCard` when `species === 'Unknown'`.
  - Prominent "Rescue details needed" callout on `AnimalDetailScreen` when viewing a stub.
  - Smooth species preset selector in `AnimalIntakeScreen` when editing a stub (allowing picking Dog/Cat/etc. directly without defaulting to "Other: Unknown").

- [ ] **Step 1: Write failing test for stub indicators**

Create `tests/unit/animals/animalCardStub.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const baseAnimal: AnimalWithStatus = {
  id: 'a1',
  org_id: 'org1',
  shelter_code: 'TS-001',
  name: null,
  species: 'Dog',
  archived: 0,
  intake_date: '2026-10-03',
  status_id: 's1',
  status_labels: ['Intake'],
  created_at: '2026-10-03T00:00:00Z',
  updated_at: '2026-10-03T00:00:00Z',
}

describe('AnimalCard stub indicator', () => {
  it('does not display Add details badge when species is known', () => {
    render(
      <MemoryRouter>
        <AnimalCard animal={baseAnimal} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/add details/i)).toBeNull()
  })

  it('displays Add details badge when species is Unknown', () => {
    render(
      <MemoryRouter>
        <AnimalCard animal={{ ...baseAnimal, species: 'Unknown' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/add details/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animals/animalCardStub.test.tsx`
Expected: FAIL because `Add details` badge is not rendered.

- [ ] **Step 3: Update `AnimalCard.tsx`, `AnimalDetailScreen.tsx`, and `AnimalIntakeScreen.tsx`**

In `src/features/animals/components/AnimalCard.tsx`:
Add stub indicator pill:
```tsx
{animal.species === 'Unknown' ? (
  <span className="animal-card__stub-pill">Add details</span>
) : null}
```

In `src/features/animals/screens/AnimalIntakeScreen.tsx`:
Update `splitSpecies`:
```typescript
function splitSpecies(species: string | null | undefined): {
  preset: string
  other: string
} {
  const value = species?.trim() ?? ''
  if (!value || value === 'Unknown') return { preset: 'Dog', other: '' }
  if (SPECIES_PRESETS.includes(value) && value !== 'Other') {
    return { preset: value, other: '' }
  }
  return { preset: 'Other', other: value }
}
```

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
When `animal.species === 'Unknown'`, render a banner above the animal details:
```tsx
{animal.species === 'Unknown' && (
  <div className="panel panel--subtle stack stack--tight" style={{ borderLeft: '4px solid var(--color-forest)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <strong>Rescue details needed</strong>
      <Button to={`/animals/${animal.id}/edit`} variant="secondary" size="sm">
        Add details →
      </Button>
    </div>
    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-ink-muted)' }}>
      This animal was saved during quick field intake.
    </p>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animals/animalCardStub.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/animals/components/AnimalCard.tsx src/features/animals/screens/AnimalIntakeScreen.tsx src/features/animals/screens/AnimalDetailScreen.tsx tests/unit/animals/animalCardStub.test.tsx
git commit -m "feat(animals): show Add details indicators for stubs on animal card and detail views"
```

---

### Task 5: End-to-End Verification & Production Build

**Files:**
- Verification only

- [ ] **Step 1: Run all unit and integration tests**

Run: `npm test -- --run`
Expected: All test suites PASS with 0 failures.

- [ ] **Step 2: Run production TypeScript and Vite build**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with exit code 0.

- [ ] **Step 3: Test live flow on `https://sanctuary.sohaibbinmohsin.com`**

Verify:
- On desktop, clicking "Add animal" navigates to `/animals/new`.
- Emulating mobile device (or opening on phone), clicking "Add animal" opens `/animals/camera`.
- Tapping shutter button displays the confirm card matching the approved prototype.
- Tapping "Add details later" creates stub, resets camera, and displays toast.
- Animals list shows the created stub with the "Add details" badge.
