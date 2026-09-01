# First-Time User Onboarding & Account Setup Specification

**Date:** 2026-08-31  
**Status:** Approved  
**Topic:** First-Time User Onboarding & Account Setup Wizard

---

## 1. Overview & Goal

When a shelter administrator logs in for the first time after their account is provisioned, Sanctuary needs a guided, focused setup flow (onboarding wizard) that allows them to configure essential shelter details before starting day-to-day operations.

The setup flow will guide the user through:
1. **Shelter Identity**: Shelter / organization name, shelter code initials, and optional logo upload.
2. **Animal Statuses**: Reviewing, customizing, reordering, and setting in-care flags on default statuses (*Intake, Quarantine, Treatment, In sanctuary, Adopted, Transferred, Deceased*).
3. **Ledger Categories**: Reviewing and customizing default money-in (*Donation*) and money-out (*Medical & Vet, Food & Nutrition, Supplies & Bedding, Facility & Operations*) categories.

---

## 2. Architecture & Data Model

### 2.1 Database Schema Migration (Supabase Postgres)
A new migration `20260831120000_organization_setup_completed.sql` will add the `setup_completed` boolean column to the `organizations` table:

```sql
-- Track whether the initial shelter setup wizard has been completed
alter table organizations
  add column if not exists setup_completed boolean not null default false;

-- Backfill existing organizations so existing active shelters remain unaffected
update organizations
set setup_completed = true
where setup_completed is false;
```

### 2.2 PowerSync Schema & Model Updates
- In `src/features/sync/powersync/schema.ts`:
  - Add `setup_completed: column.integer` (0 for false, 1 for true) to the `organizations` schema table.
  - Update `OrganizationRecord` type to include `setup_completed?: number | null`.

### 2.3 Bootstrap & Current Member Hook
- In `src/shared/hooks/useCurrentMember.ts`:
  - Extend `CurrentMember` interface with `setupCompleted: boolean`.
  - Include `o.setup_completed as org_setup_completed` in the SQL query.
  - Set `setupCompleted: row.org_setup_completed === 1`.
- In `src/features/sync/hydrateOrgBootstrap.ts`:
  - Include `setup_completed` in the `organizations` SELECT query and SQLite INSERT statement.

---

## 3. Routing & Lifecycle Guard

### 3.1 Route Registration
- Add `/onboarding` to `src/app/router.tsx` and `src/app/App.tsx`.
- The onboarding screen renders with a dedicated layout that omits the regular operational sidebar and bottom navigation bar, providing a focused setup experience.

### 3.2 Access & Role Rules
When a signed-in session is active:
1. **Loading State**: Displays `SplashScreen` until user membership and local database hydration are initialized.
2. **When `setupCompleted === false`**:
   - **Admin role (`role === 'admin'`)**: User is automatically directed to `/onboarding`. Any attempt to navigate to operational routes (`/animals`, `/ledger`, `/settings`, etc.) redirects to `/onboarding`.
   - **Non-Admin role (`staff` / `volunteer`)**: User is shown a calm notice screen: *"Your shelter's account is currently being set up by an administrator. Please check back shortly."* with a "Sign out" action.
3. **When `setupCompleted === true`**:
   - User is directed to `/animals` (or requested route). Any direct attempt to load `/onboarding` redirects to `/animals`.

---

## 4. Onboarding UI / UX Flow

The onboarding screen features a 3-step wizard with a clean progress indicator using Sanctuary's Forest design system (`--color-forest`, `--color-forest-soft`, `--color-surface`, DM Sans & Outfit typography).

### Step 1: Shelter Identity
- **Inputs**:
  - **Shelter Name** (required, text input): e.g. "Lahore Animal Sanctuary".
  - **Initials / Prefix** (text input): Auto-generated from initials of the shelter name (e.g. "LAS"), with manual override support. Used for animal shelter codes (e.g., `LAS-001`).
  - **Shelter Logo** (optional file upload): Drag/click upload with instant preview thumbnail and "Replace / Remove" buttons.
- **Navigation**: `Continue to Animal Statuses →` button (enabled once shelter name is non-empty).

### Step 2: Animal Statuses
- **Description**: Friendly guidance explaining how statuses represent animal workflow stages and affect in-care census counts.
- **Initial Recommended Defaults**:
  1. `Intake` (In care)
  2. `Quarantine` (In care)
  3. `Treatment` (In care)
  4. `In sanctuary` (In care)
  5. `Adopted` (Out of care)
  6. `Transferred` (Out of care)
  7. `Deceased` (Out of care)
- **Interactive Controls**:
  - Inline editing of status labels.
  - Toggle / dropdown for "In care" vs "Out of care".
  - Add new status inline.
  - Delete status button (enforces a minimum of 1 status).
  - Reorder items via drag or move controls.
- **Navigation**: `← Back` and `Continue to Ledger Categories →`.

### Step 3: Ledger Categories
- **Description**: Guidance explaining money in / money out categories for tracking shelter finances.
- **Initial Recommended Defaults**:
  - **Money In**:
    - `Donation`
  - **Money Out**:
    - `Food & Nutrition`
    - `Medical & Vet`
    - `Supplies & Bedding`
    - `Facility & Operations`
- **Interactive Controls**:
  - Inline editing of category labels.
  - Direction badges (`Money In` / `Money Out`).
  - Add new category inline (Label + Direction selection).
  - Delete category button (enforces at least 1 category).
- **Navigation**: `← Back` and `Finish Setup & Enter Shelter →` (primary CTA).

---

## 5. Persistence & Atomic Commit

When the user clicks "Finish Setup & Enter Shelter":
1. **Logo Upload**: If an image was selected in Step 1, upload to Cloudflare R2 via `setPartnerLogo(db, member.orgId, logoFile)` and set `organizations.logo_r2_key`.
2. **Local Write Transaction (`db.writeTransaction`)**:
   - Update `organizations`:
     - `name = ?`
     - `initials = ?`
     - `setup_completed = 1`
   - Synchronize `animal_statuses`:
     - Delete any pre-existing default rows for the organization and insert the user's finalized ordered status list.
   - Synchronize `ledger_categories`:
     - Delete any pre-existing default rows for the organization and insert the user's finalized category list.
3. **Completion & Sync**:
   - PowerSync connector automatically pushes local mutations to Supabase Postgres.
   - `useCurrentMember` hook updates `setupCompleted` to `true`.
   - The user is navigated smoothly to `/animals`.
4. **Error Handling**:
   - If an error occurs during commit, the wizard remains on Step 3 with a descriptive error message and the user's input intact for retry.

---

## 6. Verification Plan

1. **Unit & Domain Tests**:
   - Verify `useCurrentMember` correctly parses `setup_completed`.
   - Verify onboarding atomic commit logic correctly writes organizations, statuses, and ledger categories.
2. **Router & Guard Tests**:
   - Verify uncompleted setup redirects admins to `/onboarding`.
   - Verify uncompleted setup displays waiting screen for non-admin roles.
   - Verify completed setup allows access to main app routes and blocks `/onboarding`.
3. **Manual Flow Verification**:
   - Step through the 3-step wizard with new shelter data, uploading a logo, customizing statuses, and adding/removing ledger categories.
   - Verify that upon clicking "Finish Setup", data is saved in SQLite and synchronized to Supabase, and the user lands on `/animals`.
