# Emergency Reports Integration & Organization Module Access Control Spec

**Date:** 2026-10-13  
**Status:** Approved  
**Related Requirements:** Integrate prototype into production React app, organization-level feature flags in DB, account presets, clean Emergency Reports workflow (removing reporter anonymous toggle).

---

## 1. Executive Summary

This specification defines the integration of the **Rescue Reports** workflow into the Sanctuary production codebase, alongside a database-driven **Module Access Control** system.

Organizations will have their accessible features toggled at the organization level (`enabled_modules` in database). Super Admins can assign module presets (*Full Sanctuary & Rescue*, *Sanctuary Only*, *Rescue Hotline Only*, *Foster/Clinic Network*, or *Custom*) to grant or restrict access to:
- `reports` (Emergency triage, dispatch, timeline, disposition)
- `animals` (Animal inventory, care logs, timeline, relationships)
- `checklist` (Daily routine & feeding checklist)
- `ledger` (Financial transactions and transparency)

All citizen reporter identities are treated as confidential/internal by default (the `reporter_is_anonymous` toggle is removed).

---

## 2. Database Schema & Sync Layer

### 2.1 Table: `organizations` (Update)
Add column `enabled_modules: column.text` in `src/features/sync/powersync/schema.ts`.
- Format: JSON-stringified array of strings (e.g., `'["reports", "animals", "checklist", "ledger"]'`).
- Defaults to full suite for existing orgs if NULL: `["reports", "animals", "checklist", "ledger"]`.

### 2.2 Table: `rescue_reports` (New)
Add table `rescue_reports` in `src/features/sync/powersync/schema.ts`:
- `id: column.text` (UUID, primary key)
- `org_id: column.text` (indexed)
- `report_number: column.text` (Human-readable triage code, e.g. `PARC-R105`)
- `category: column.text` (e.g. `'emergency'`)
- `species: column.text` (`'dog'`, `'cat'`, `'donkey'`, `'horse'`, `'bird'`, `'other'`)
- `chief_complaint: column.text`
- `status: column.text` (`'logged'`, `'accepted'`, `'dispatched'`, `'attended'`, `'cancelled'`)
- `location_area: column.text`
- `location_landmark: column.text`
- `reporter_name: column.text`
- `reporter_phone: column.text`
- `disposition_type: column.text` (`'spot_released'`, `'transferred_partner'`, `'admitted_shelter'`, null)
- `animal_id: column.text` (nullable FK linking to `animals.id` when attended and admitted or linked)
- `stage_logged_at: column.text`
- `stage_accepted_at: column.text`
- `stage_dispatched_at: column.text`
- `stage_attended_at: column.text`
- `created_at: column.text`
- `updated_at: column.text`

Indexes:
- `by_org`: `['org_id']`
- `by_status`: `['status']`
- `by_animal`: `['animal_id']`

### 2.3 Table: `report_photos` (New)
Photos attached during intake or field dispatch:
- `id: column.text`
- `org_id: column.text`
- `report_id: column.text`
- `r2_key: column.text`
- `local_only: column.integer`
- `upload_state: column.text`
- `created_at: column.text`

Indexes:
- `by_report`: `['report_id']`

---

## 3. Organization-Level Module Access Control

### 3.1 Domain & Hook Layer
In `src/shared/hooks/useCurrentMember.ts`:
- Extend `CurrentMember` interface:
  ```ts
  export type AppModuleId = 'reports' | 'animals' | 'checklist' | 'ledger'

  export type CurrentMember = {
    // ...existing fields
    enabledModules: Set<AppModuleId>
    hasModule: (module: AppModuleId) => boolean
  }
  ```
- Parse `org_enabled_modules` in `mapMemberRow`. If null/empty, default to all modules.

### 3.2 Account Presets
Define preset mappings in `src/shared/domain/modules.ts`:
- **Full Sanctuary & Rescue**: `['reports', 'animals', 'checklist', 'ledger']`
- **Sanctuary Only**: `['animals', 'checklist', 'ledger']`
- **Rescue Hotline Only**: `['reports', 'animals']`
- **Clinic / Foster Network**: `['animals', 'checklist']`
- **Custom**: User-selected checkboxes

### 3.3 Dynamic App Navigation & Route Protection
In `src/app/router.tsx`:
- Compute `sidebarItems` and `bottomNavItems` by filtering definitions against `member.hasModule(moduleId)`.
- If a user navigates directly to a disabled path (e.g. `/ledger` when `ledger` is off), redirect them to their organization's first available landing module (fallback to `/reports` or `/animals`).

---

## 4. Emergency Reports Screens & Workflow

### 4.1 Reports Timeline Screen (`/reports`)
- **Feed Structure**: Grouped chronologically by date (`Today`, `Yesterday`, etc.).
- **Card Format**:
  - Left column: Time (`14:10`) and elapsed subtext (`25m ago`).
  - Main clickable card:
    - Row 1: `PARC-R105 · DOG` (Report ID + Species pill) and centered Status pill (`New Report`, `Dispatched`, `At Partner Vet`, `In Shelter`).
    - Row 2: Single-line Chief Complaint.
- **Top Actions**: `+ Log report` primary button (Brand Forest or Theme Primary).
- **Filter Segment**: `All`, `New reports`, `In progress`, `Completed`.

### 4.2 Report Detail Screen (`/reports/:id`)
- **Unboxed Header**:
  - `PARC-R105` with status badge centered vertically in the same row (`New Report (Awaiting Decision)`).
  - Top-right Stage Action Button:
    - Styled in Brand Amber/Orange (`rgb(222, 107, 43)`).
    - Dynamic label based on stage:
      - Logged → `Accept & Triage` (with dropdown for `Decline / Cancel`)
      - Accepted → `Dispatch Ambulance`
      - Dispatched → `Mark Attended`
      - Attended → Disposition actions (`Spot Release (TNR)` or `Create/Link Animal Record`)
- **Pipeline Stage Tracker**:
  - Horizontal clean stepper tracking timestamps:
    - 1: Report Logged (`Today 14:10`)
    - 2: Triage Decision (`Awaiting decision`)
    - 3: Field & Transport (`-`)
    - 4: Animal Attended (`-`)
- **Facts Grid**:
  - **Photos & Proof**: Captured injury/case photos.
  - **Condition & Animal**: Category badge (`Medical Emergency`), Species (`Dog`), Chief Complaint.
  - **Location & Landmark**: Area and landmark details.
  - **Reporter Information**: Reporter Phone with direct call button (no anonymous toggle, always confidential/staff-only).

### 4.3 Log Report Modal (`+ Log report`)
- Rendered via `ResponsiveSheetModal` (bottom sheet on mobile, centered modal on desktop).
- Form fields:
  - Species picker (Dog, Cat, Donkey, Horse, Bird, Other)
  - Chief Complaint / Injury description
  - Location Area & Landmark
  - Reporter Name & Phone number
  - Optional intake photo capture
- Submits locally to SQLite `rescue_reports` and syncs via PowerSync.

---

## 5. UI & Design System Compliance
- **Theme**: Light theme only, adhering strictly to Sanctuary design tokens.
- **Typography**: Outfit for display headers, DM Sans for body/controls, DM Mono for shelter codes (`PARC-R105`).
- **Touch Targets**: Minimum 44px on all interactable elements.
- **Color Palette**:
  - Forest Green for brand and primary actions.
  - Amber / Brand Orange for urgency/triage stage buttons.
  - Neutral stone/cream backgrounds with soft borders.

---

## 6. Testing & Quality Gates
1. Unit tests for `rescue_reports` domain logic (report creation, stage transitions, spot release vs intake linkage).
2. Unit tests for `useCurrentMember` module parsing and presets.
3. Unit tests for navigation filtering and route guard redirects in `AppShell`.
4. Production build check: `npm run build` must succeed with 0 errors.
