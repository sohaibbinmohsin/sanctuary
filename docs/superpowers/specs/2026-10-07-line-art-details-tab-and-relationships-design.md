# Species Line Art, Dynamic Tabs, Details Tab, and Animal Relationships Design

**Date**: 2026-10-07  
**Branch**: `feature/camera-quick-intake`  
**Status**: Approved Design Spec  

---

## 1. Executive Summary

This feature set extends Sanctuary's animal profiling capabilities with four cohesive enhancements:
1. **Species Line Art Illustration System**: A library of 12 clean vector line art illustrations covering all supported species (`Dog`, `Cat`, `Horse`, `Donkey`, `Bird`, `Other`) across two life stages (`adult` and `child`). Used as the visual placeholder whenever an animal has no uploaded photo.
2. **Life Stage Support**: Storing whether an animal is an `adult` or `child` (puppy, kitten, foal, chick) directly in the local database schema.
3. **Dynamic Tab Reordering on Profile**: Intelligent ordering of profile tabs:
   - When care logs exist: `[ Care (default) ] [ Timeline ] [ Details ]`
   - When no care logs exist: `[ Timeline (default) ] [ Care ] [ Details ]`
   - Details tab is permanently positioned as the third tab.
4. **Details Tab & Bidirectional Animal Relationships**: A dedicated third tab displaying full physical attributes with a modal editor, plus a relationship management system tracking bonded pairs, family bonds, and incompatibility warnings with automatic reciprocal synchronization.

---

## 2. Data Architecture & Schema

### 2.1 Database Schema Additions (`schema.ts`)

In `src/features/sync/powersync/schema.ts`:

1. **`animals` Table Modification**:
   - Add column `life_stage: column.text` (`'adult' | 'child'`).
   - Default value for existing records: `'adult'`.

2. **New `animal_relationships` Table**:
   ```ts
   const animal_relationships = new Table(
     {
       org_id: column.text,
       animal_id: column.text,
       related_animal_id: column.text,
       relationship_type: column.text, // 'bonded' | 'mother' | 'child' | 'sibling' | 'incompatible'
       notes: column.text,
       created_at: column.text,
     },
     {
       indexes: {
         by_animal: ['animal_id'],
         by_related: ['related_animal_id'],
         by_org: ['org_id'],
       },
     },
   )
   ```

### 2.2 Relationship Types & Reciprocal Pairing

The relationship system supports 5 canonical types with exact symmetrical pairings:

| Type | Display Label | Reciprocal Type | Description |
|---|---|---|---|
| `bonded` | Bonded | `bonded` | Animals must be housed, cared for, or adopted together |
| `mother` | Mother | `child` | Direct maternal relationship |
| `child` | Child | `mother` | Direct offspring relationship |
| `sibling` | Sibling | `sibling` | Littermates or siblings |
| `incompatible` | Incompatible | `incompatible` | Severe warning: keep strictly separated |

### 2.3 Domain Functions (`src/features/animals/domain/relationships.ts`)

- `getAnimalRelationships(db, animalId)`: Queries `animal_relationships` joined with `animals` and their primary photo to return related animal details.
- `linkAnimals(db, { orgId, animalId, relatedAnimalId, relationshipType, notes })`:
  - Validates `animalId !== relatedAnimalId`.
  - Executes in a single database transaction:
    - Inserts `(animalId, relatedAnimalId, relationshipType, notes)`
    - Inserts `(relatedAnimalId, animalId, reciprocalType, notes)`
- `unlinkAnimals(db, { animalId, relatedAnimalId })`:
  - Executes in a single database transaction:
    - Deletes relationship `(animalId, relatedAnimalId)`
    - Deletes relationship `(relatedAnimalId, animalId)`

---

## 3. Vector Line Art Illustration System

### 3.1 Modular Component (`AnimalLineArt.tsx`)

Located at `src/features/animals/components/AnimalLineArt.tsx`:

- Props:
  ```ts
  export type AnimalLineArtProps = {
    species: string | null | undefined
    lifeStage?: 'adult' | 'child' | null | undefined
    className?: string
    aspectRatio?: 'square' | 'video' | 'cover'
  }
  ```
- Renders 12 distinct vector line art paths:
  1. `Dog` + `adult`: Adult dog silhouette, sturdy snout, folded/perked ears
  2. `Dog` + `child`: Puppy outline, rounder head, shorter muzzle, playful posture
  3. `Cat` + `adult`: Sleek feline profile, upright pointed ears, curved tail
  4. `Cat` + `child`: Kitten outline, compact paws, oversized curious ears
  5. `Horse` + `adult`: Regal equine bust, sculpted neck, flowing mane outline
  6. `Horse` + `child`: Slender foal outline, short tufted mane, alert posture
  7. `Donkey` + `adult`: Distinct upright long ears, sturdy head, tufted muzzle
  8. `Donkey` + `child`: Baby donkey / foal with oversized long ears and compact body
  9. `Bird` + `adult`: Graceful perched bird silhouette, sleek beak and tail feathers
  10. `Bird` + `child`: Round, fluffy baby chick outline with miniature beak
  11. `Other` + `adult`: Stylized gentle wildlife silhouette and sanctuary paw emblem
  12. `Other` + `child`: Miniature juvenile creature outline and small paw emblem
- **Safety Fallback**: If `species` is unrecognized, blank, or `"Unknown"`, safely renders `Other`. If `lifeStage` is undefined, defaults to `adult`.

### 3.2 Global Integration Points

- `<AnimalCard>`: Rendered whenever `animal.photo_url` is missing or fails to load.
- `ChecklistScreen` & `AddToChecklistScreen`: Rendered on checklist cards without photos.
- `AnimalDetailScreen`: Rendered full-bleed in the hero banner frame when no primary photo exists.

---

## 4. Profile Dynamic Tabs & Details Tab UI

### 4.1 Dynamic Tab Switching (`AnimalDetailScreen.tsx`)

- Condition: `hasCareNotes = careTreatments.length > 0`
- **When `hasCareNotes === true`**:
  - Tab 1: **Care** (default active tab)
  - Tab 2: **Timeline**
  - Tab 3: **Details**
- **When `hasCareNotes === false`**:
  - Tab 1: **Timeline** (default active tab)
  - Tab 2: **Care**
  - Tab 3: **Details**
- Tab switcher uses accessible ARIA roles (`role="tablist"`, `role="tab"`) and persists active tab selection during user interaction.

### 4.2 Details Tab Layout

1. **Physical Characteristics Card**:
   - Header: "Animal Details" with `[Edit details]` secondary button.
   - Grid of fields:
     - Species & Life Stage (e.g., `Dog · Adult` or `Cat · Child / Kitten`)
     - Sex (`Female` / `Male` / `Unknown`)
     - Markings description
     - Intake Date & Shelter Code
2. **Relationships Card**:
   - Header: "Relationships" with `[+ Link animal]` secondary button.
   - Empty State: *"No linked animals yet. Record family members, bonded pairs, or incompatibility warnings."*
   - Related Animal Items:
     - Avatar: Photo thumbnail or `<AnimalLineArt>` mini badge
     - Name and shelter code (link navigating to `/animals/:id`)
     - Relationship badge:
       - `Bonded`: Forest green badge
       - `Mother` / `Child` / `Sibling`: Warm amber badge
       - `Incompatible`: Danger red warning badge
     - Unlink button (trash icon) with confirmation

### 4.3 Modal Workflows (`ResponsiveSheetModal`)

1. **`EditAnimalDetailsModal`**:
   - Species presets (`Dog`, `Cat`, `Horse`, `Donkey`, `Bird`, `Other`)
   - Life stage toggle: `Adult` vs `Child`
   - Sex picker: `Female`, `Male`, `Unknown`
   - Markings text input
   - Primary Save button (`variant="primary"`)
2. **`LinkAnimalModal`**:
   - Search input filtering shelter animals (excluding the current animal)
   - Relationship type radio/dropdown (`Bonded`, `Mother`, `Child`, `Sibling`, `Incompatible`)
   - Optional relationship notes
   - Primary Save button (`variant="primary"`)

---

## 5. Testing & Verification Plan

### 5.1 Unit Tests
- `tests/unit/animals/animalRelationships.test.ts`:
  - Reciprocal creation of `bonded`, `mother`/`child`, `sibling`, and `incompatible`.
  - Reciprocal deletion when unlinking.
  - Rejection of self-linking and duplicates.
- `tests/unit/animals/animalLineArt.test.tsx`:
  - Renders valid SVGs for all 12 combinations of species and life stage.
  - Fallback behavior for null, undefined, or invalid species.
- `tests/unit/animals/animalDetailDynamicTabs.test.tsx`:
  - Verifies tab order `[Care, Timeline, Details]` when care notes exist.
  - Verifies tab order `[Timeline, Care, Details]` when care notes are empty.
  - Verifies default active tab behavior.
- `tests/unit/animals/animalDetailRelationships.test.tsx`:
  - Renders relationships list inside Details tab.
  - Dispatches modal open/close events and unlinking actions.

### 5.2 Verification Commands
- `npx vitest run tests/unit/animals/`
- Full test suite: `npm test -- --run`
- Full production build: `npm run build` (`tsc -b && vite build`)
- Visual verification: Headless Chrome screenshots across mobile (412x915) and desktop (1280x915).
