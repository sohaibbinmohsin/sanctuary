# Species Line Art, Dynamic Tabs, Details Tab, and Animal Relationships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 12 species line-art illustrations as photo placeholders across the application, support adult/child life stages, dynamically reorder animal profile tabs based on care history, and provide a full Details tab with bidirectional animal relationships.

**Architecture:** Extend the PowerSync schema with `life_stage` on `animals` and a new `animal_relationships` table with dual-record reciprocal synchronization. Build a modular `<AnimalLineArt>` vector illustration component replacing missing images. Update `AnimalDetailScreen` to conditionally position the Care vs Timeline tab first and render a dedicated Details tab with metadata editing and relationship management modals.

**Tech Stack:** React 19, TypeScript, PowerSync (SQLite offline-first), Vitest, Vite, Phosphor Icons, CSS Tokens.

**Spec:** [`docs/superpowers/specs/2026-10-07-line-art-details-tab-and-relationships-design.md`](file:///home/ubuntu/development/sanctuary/docs/superpowers/specs/2026-10-07-line-art-details-tab-and-relationships-design.md)

## Global Constraints

- Light theme only, strictly adhering to Sanctuary design tokens (`--color-forest`, `--color-amber`, `--color-surface`, etc.)
- Typography: Outfit for headers, DM Sans for body/controls, DM Mono for shelter codes
- Touch targets >= 44px minimum touch area on all buttons and interactive controls
- Offline-first execution via PowerSync (`SanctuaryDb`)
- Strictly NEVER push to `main` or merge PRs into `main`. All work on `feature/camera-quick-intake`.
- **MANDATORY**: Full production build (`npm run build`) MUST be verified with 0 errors before completing any task.

---

### Task 1: PowerSync Schema & Life Stage / Relationships Domain

**Files:**
- Modify: `src/features/sync/powersync/schema.ts:52-70`
- Modify: `src/features/animals/domain/animals.ts:15-75, 320-360`
- Create: `src/features/animals/domain/relationships.ts`
- Test: `tests/unit/animals/animalRelationships.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/features/animals/domain/relationships.ts
  export type RelationshipType = 'bonded' | 'mother' | 'child' | 'sibling' | 'incompatible'

  export type AnimalRelationship = {
    id: string
    orgId: string
    animalId: string
    relatedAnimalId: string
    relatedAnimalName: string
    relatedShelterCode: string
    relatedSpecies: string
    relatedLifeStage: 'adult' | 'child'
    relatedPhotoUrl: string | null
    relationshipType: RelationshipType
    notes: string | null
    createdAt: string
  }

  export function getReciprocalType(type: RelationshipType): RelationshipType

  export async function getAnimalRelationships(
    db: SanctuaryDb,
    animalId: string
  ): Promise<AnimalRelationship[]>

  export async function linkAnimals(
    db: SanctuaryDb,
    input: {
      orgId: string
      animalId: string
      relatedAnimalId: string
      relationshipType: RelationshipType
      notes?: string | null
    }
  ): Promise<void>

  export async function unlinkAnimals(
    db: SanctuaryDb,
    input: { animalId: string; relatedAnimalId: string }
  ): Promise<void>
  ```

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalRelationships.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getReciprocalType,
  linkAnimals,
  unlinkAnimals,
  getAnimalRelationships,
  type RelationshipType,
} from '@/features/animals/domain/relationships'

type MemoryRow = Record<string, unknown>

class MockDb {
  tables: Record<string, MemoryRow[]> = {
    animal_relationships: [],
    animals: [],
    photos: [],
  }

  async getAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM animal_relationships')) {
      const animalId = params[0] as string
      const rels = this.tables.animal_relationships.filter((r) => r.animal_id === animalId)
      return rels.map((r) => {
        const animal = this.tables.animals.find((a) => a.id === r.related_animal_id) || {}
        return {
          id: r.id,
          org_id: r.org_id,
          animal_id: r.animal_id,
          related_animal_id: r.related_animal_id,
          relationship_type: r.relationship_type,
          notes: r.notes,
          created_at: r.created_at,
          related_name: animal.name || '',
          related_shelter_code: animal.shelter_code || '',
          related_species: animal.species || '',
          related_life_stage: animal.life_stage || 'adult',
          related_photo_url: null,
        }
      }) as unknown as T[]
    }
    return []
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO animal_relationships')) {
      this.tables.animal_relationships.push({
        id: params[0],
        org_id: params[1],
        animal_id: params[2],
        related_animal_id: params[3],
        relationship_type: params[4],
        notes: params[5],
        created_at: params[6],
      })
    } else if (sql.startsWith('DELETE FROM animal_relationships')) {
      const a = params[0] as string
      const b = params[1] as string
      this.tables.animal_relationships = this.tables.animal_relationships.filter(
        (r) => !(r.animal_id === a && r.related_animal_id === b),
      )
    }
  }

  async writeTransaction<T>(fn: (tx: MockDb) => Promise<T>): Promise<T> {
    return fn(this)
  }
}

describe('Animal Relationships Domain', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
    db.tables.animals = [
      { id: 'a1', org_id: 'org1', name: 'Luna', shelter_code: 'LUN', species: 'Cat', life_stage: 'adult' },
      { id: 'a2', org_id: 'org1', name: 'Shadow', shelter_code: 'SHA', species: 'Cat', life_stage: 'child' },
    ]
  })

  it('correctly determines reciprocal types', () => {
    expect(getReciprocalType('bonded')).toBe('bonded')
    expect(getReciprocalType('sibling')).toBe('sibling')
    expect(getReciprocalType('incompatible')).toBe('incompatible')
    expect(getReciprocalType('mother')).toBe('child')
    expect(getReciprocalType('child')).toBe('mother')
  })

  it('rejects linking animal to itself', async () => {
    await expect(
      linkAnimals(db as any, {
        orgId: 'org1',
        animalId: 'a1',
        relatedAnimalId: 'a1',
        relationshipType: 'bonded',
      }),
    ).rejects.toThrow('Cannot link an animal to itself')
  })

  it('creates reciprocal records in a transaction', async () => {
    await linkAnimals(db as any, {
      orgId: 'org1',
      animalId: 'a1',
      relatedAnimalId: 'a2',
      relationshipType: 'mother',
      notes: 'Litter born in spring',
    })

    const a1Rels = await getAnimalRelationships(db as any, 'a1')
    expect(a1Rels).toHaveLength(1)
    expect(a1Rels[0].relatedAnimalName).toBe('Shadow')
    expect(a1Rels[0].relationshipType).toBe('mother')

    const a2Rels = await getAnimalRelationships(db as any, 'a2')
    expect(a2Rels).toHaveLength(1)
    expect(a2Rels[0].relatedAnimalName).toBe('Luna')
    expect(a2Rels[0].relationshipType).toBe('child')
  })

  it('unlinks both directional records atomically', async () => {
    await linkAnimals(db as any, {
      orgId: 'org1',
      animalId: 'a1',
      relatedAnimalId: 'a2',
      relationshipType: 'bonded',
    })

    await unlinkAnimals(db as any, { animalId: 'a1', relatedAnimalId: 'a2' })

    const a1Rels = await getAnimalRelationships(db as any, 'a1')
    const a2Rels = await getAnimalRelationships(db as any, 'a2')
    expect(a1Rels).toHaveLength(0)
    expect(a2Rels).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalRelationships.test.ts`
Expected: FAIL (Cannot find module `@/features/animals/domain/relationships`)

- [ ] **Step 3: Update schema and implement domain**
1. In `src/features/sync/powersync/schema.ts`, add `life_stage: column.text` to `animals` table and define `animal_relationships` Table.
2. In `src/features/animals/domain/animals.ts`, add `life_stage?: 'adult' | 'child'` to `AnimalRecord`, `CreateAnimalInput`, and `UpdateAnimalInput`.
3. Create `src/features/animals/domain/relationships.ts` with `getReciprocalType`, `linkAnimals`, `unlinkAnimals`, and `getAnimalRelationships`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalRelationships.test.ts`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/sync/powersync/schema.ts src/features/animals/domain/ tests/unit/animals/animalRelationships.test.ts
git commit -m "feat(animals): add life_stage and animal_relationships schema and domain logic"
```

---

### Task 2: Vector Line Art Illustration System (`<AnimalLineArt>`)

**Files:**
- Create: `src/features/animals/components/AnimalLineArt.tsx`
- Create: `src/features/animals/components/AnimalLineArt.css`
- Test: `tests/unit/animals/animalLineArt.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/features/animals/components/AnimalLineArt.tsx
  export type AnimalLineArtProps = {
    species?: string | null
    lifeStage?: 'adult' | 'child' | null
    className?: string
    aspectRatio?: 'square' | 'video' | 'cover'
    role?: string
    ariaLabel?: string
  }
  export function AnimalLineArt(props: AnimalLineArtProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalLineArt.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimalLineArt } from '@/features/animals/components/AnimalLineArt'

describe('AnimalLineArt', () => {
  it('renders SVG for adult Dog', () => {
    const { container } = render(<AnimalLineArt species="Dog" lifeStage="adult" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('data-species')).toBe('dog')
    expect(svg?.getAttribute('data-stage')).toBe('adult')
  })

  it('renders distinct SVG for puppy (Dog child)', () => {
    const { container } = render(<AnimalLineArt species="Dog" lifeStage="child" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-species')).toBe('dog')
    expect(svg?.getAttribute('data-stage')).toBe('child')
  })

  it('renders all species variants without error', () => {
    const speciesList = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']
    for (const species of speciesList) {
      for (const lifeStage of ['adult', 'child'] as const) {
        const { container } = render(<AnimalLineArt species={species} lifeStage={lifeStage} />)
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
      }
    }
  })

  it('falls back to Other adult when species is unknown or null', () => {
    const { container } = render(<AnimalLineArt species={null} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-species')).toBe('other')
    expect(svg?.getAttribute('data-stage')).toBe('adult')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalLineArt.test.tsx`
Expected: FAIL (Cannot find module `@/features/animals/components/AnimalLineArt`)

- [ ] **Step 3: Implement AnimalLineArt component and CSS**
Implement `AnimalLineArt.tsx` rendering clean SVG vector paths for the 12 combinations (Dog, Cat, Horse, Donkey, Bird, Other x adult, child) with smooth rounded strokes (`strokeLinecap="round" strokeLinejoin="round"`), styled via `AnimalLineArt.css`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalLineArt.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/animals/components/AnimalLineArt.* tests/unit/animals/animalLineArt.test.tsx
git commit -m "feat(ui): create AnimalLineArt vector illustration component with 12 variants"
```

---

### Task 3: Integrate Line Art as Photo Fallbacks Across App

**Files:**
- Modify: `src/features/animals/components/AnimalCard.tsx`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Modify: `src/features/animals/screens/AddToChecklistScreen.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalLineArtFallbacks.test.tsx`

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalLineArtFallbacks.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from '@/features/animals/components/AnimalCard'

describe('AnimalCard Line Art Fallback', () => {
  it('renders AnimalLineArt when primaryPhotoUrl is null', () => {
    const animal = {
      id: 'a1',
      shelterCode: 'A-01',
      name: 'Barnaby',
      species: 'Dog',
      lifeStage: 'adult' as const,
      statusLabel: 'Intake',
      statusTone: 'forest' as const,
      primaryPhotoUrl: null,
      notes: null,
    }

    const { container } = render(
      <MemoryRouter>
        <AnimalCard animal={animal} />
      </MemoryRouter>
    )

    const lineArt = container.querySelector('.animal-line-art')
    expect(lineArt).toBeTruthy()
    expect(lineArt?.getAttribute('data-species')).toBe('dog')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalLineArtFallbacks.test.tsx`
Expected: FAIL (lineArt is null or not found)

- [ ] **Step 3: Implement line art fallbacks in AnimalCard, AddToChecklistScreen, and AnimalDetailScreen**
In `AnimalCard.tsx`:
Replace missing photo placeholder with `<AnimalLineArt species={animal.species} lifeStage={animal.lifeStage} />`.
In `AnimalDetailScreen.tsx`:
When `selectedPhoto?.url` or primary photo is absent, render `<AnimalLineArt species={animal.species} lifeStage={animal.life_stage} />` full-bleed in `.detail-hero__photo`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalLineArtFallbacks.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/animals/ components/ screens/ tests/unit/animals/animalLineArtFallbacks.test.tsx
git commit -m "feat(animals): integrate AnimalLineArt as fallback for cards, checklist, and detail hero"
```

---

### Task 4: Dynamic Profile Tab Switcher (Care vs Timeline vs Details)

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:610-660`
- Test: `tests/unit/animals/animalDetailDynamicTabs.test.tsx`

**Interfaces:**
- Produces:
  - Dynamic tabs list: `[Care, Timeline, Details]` if `careTreatments.length > 0`, otherwise `[Timeline, Care, Details]`.
  - Details tab is always tab 3.
  - Active tab default initialized to Tab 1.

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalDetailDynamicTabs.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

// Mock hooks to provide animal with and without care notes
vi.mock('@/features/sync/powersync/client', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn(),
  }),
}))

describe('AnimalDetailScreen Dynamic Tabs', () => {
  it('renders Timeline first when care notes are empty', async () => {
    // When no care history exists, Timeline is tab 1, Care is tab 2, Details is tab 3
    // Render and assert tab order and active tab
  })

  it('renders Care first when care notes exist', async () => {
    // When care history exists, Care is tab 1, Timeline is tab 2, Details is tab 3
    // Render and assert tab order and active tab
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalDetailDynamicTabs.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement dynamic tab logic in AnimalDetailScreen**
In `AnimalDetailScreen.tsx`:
1. Calculate `careNotes = treatments.filter(t => t.treatment_type !== 'status')`.
2. Compute `tabOrder`:
   ```ts
   const tabs = careNotes.length > 0
     ? [
         { id: 'care', label: 'Care' },
         { id: 'timeline', label: 'Timeline' },
         { id: 'details', label: 'Details' },
       ]
     : [
         { id: 'timeline', label: 'Timeline' },
         { id: 'care', label: 'Care' },
         { id: 'details', label: 'Details' },
       ]
   ```
3. Initialize `activeTab` to `tabs[0].id` unless user explicitly switched tabs.
4. Render tab buttons matching `tabOrder`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalDetailDynamicTabs.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/animals/screens/AnimalDetailScreen.tsx tests/unit/animals/animalDetailDynamicTabs.test.tsx
git commit -m "feat(animals): dynamic tab order based on care history with Details as 3rd tab"
```

---

### Task 5: Details Tab: Characteristics View & Edit Modal

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Modify: `src/features/animals/domain/animals.ts`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalDetailCharacteristics.test.tsx`

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalDetailCharacteristics.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Verify rendering characteristics in Details tab and opening Edit details modal
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalDetailCharacteristics.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Details Tab characteristics & Edit modal**
In `AnimalDetailScreen.tsx`:
1. Under `activeTab === 'details'`, render "Animal Details" section:
   - Species, Life Stage (`Adult` / `Child`), Sex, Markings, Intake date.
   - `[Edit details]` secondary button.
2. Implement `EditAnimalDetailsModal` using `ResponsiveSheetModal`:
   - Species selector pills (`Dog`, `Cat`, `Horse`, `Donkey`, `Bird`, `Other`).
   - Life stage toggle: `Adult` vs `Child`.
   - Sex selector (`Female`, `Male`, `Unknown`).
   - Markings text input.
   - Primary Green Save button (`variant="primary"`).
3. Update `updateAnimal` to persist `life_stage`, species, sex, and markings.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalDetailCharacteristics.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/animals/ tests/unit/animals/animalDetailCharacteristics.test.tsx
git commit -m "feat(animals): add characteristics view and Edit details modal in Details tab"
```

---

### Task 6: Details Tab: Relationships List, Link Modal, & Unlinking

**Files:**
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/unit/animals/animalDetailRelationships.test.tsx`

- [ ] **Step 1: Write the failing test**
Create `tests/unit/animals/animalDetailRelationships.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
// Test rendering linked animals, badge colors (Bonded, Mother, Child, Sibling, Incompatible), and opening Link modal
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/animals/animalDetailRelationships.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Relationships section, Link modal, and Unlink action**
In `AnimalDetailScreen.tsx`:
1. Query and load `relationships` via `getAnimalRelationships(db, animalId)`.
2. Under Details tab, render "Relationships" card:
   - `[+ Link animal]` secondary button.
   - Empty state when 0 relationships.
   - List of relationships:
     - Avatar/LineArt, name, shelter code.
     - Badge with one-word type: `Bonded`, `Mother`, `Child`, `Sibling`, `Incompatible`.
     - Unlink button with confirmation.
3. Implement `LinkAnimalModal` using `ResponsiveSheetModal`:
   - Search input to filter animals in the org (excluding current animal).
   - Relationship type radio pills (`Bonded`, `Mother`, `Child`, `Sibling`, `Incompatible`).
   - Optional notes field.
   - Primary Green Save button (`variant="primary"`).
   - Calls `linkAnimals(...)` and refreshes relationships list.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/animals/animalDetailRelationships.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/features/animals/ tests/unit/animals/animalDetailRelationships.test.tsx
git commit -m "feat(animals): add relationships section, link modal, and unlinking in Details tab"
```

---

### Task 7: Full End-to-End Build & Browser Verification

**Files:**
- Create: `/tmp/verify-details-line-art.mjs` (scratch verification script)
- Artifacts: Save screenshots to brain directory.

- [ ] **Step 1: Run complete test suite**
Run: `npm test -- --run`
Expected: All test suites PASS (100% green).

- [ ] **Step 2: Run full production build**
Run: `npm run build`
Expected: PASS with 0 errors (`tsc -b && vite build`).

- [ ] **Step 3: Capture browser screenshots via headless Chrome**
1. Animal card grid showing line art for animals without photos (Dog, Cat, etc., adult and child).
2. Animal Detail screen showing dynamic tab order:
   - When no care history: `[ Timeline ] [ Care ] [ Details ]`
   - When care history exists: `[ Care ] [ Timeline ] [ Details ]`
3. Details tab view with characteristics and relationships list (`Bonded`, `Mother`, etc.).
4. Link animal modal and Edit details modal on mobile viewport.
5. Inspect captured artifacts with `view_file`.

- [ ] **Step 4: Commit and push to feature branch**
```bash
git push origin feature/camera-quick-intake
```
(STRICT: NEVER push to `main`).
