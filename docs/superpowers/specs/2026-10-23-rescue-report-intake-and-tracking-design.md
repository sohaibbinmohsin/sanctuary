# Design Specification: Public Rescue Report & Live Case Tracker

**Date**: 2026-10-23  
**Status**: Draft for User Review  
**Author**: Antigravity  
**Branch**: `feat/landing-page-network-update`  

---

## 1. Overview & Objectives

Sanctuary is expanding its public presence by introducing a dedicated public rescue intake and tracking subsystem. This allows any citizen, advocate, or rescuer to report an animal in distress without signing in, while providing live case tracking that mirrors Sanctuary's internal operations pipeline.

### Core Objectives
1. **Dedicated Public URL (`/report`)**: A standalone route with dedicated SEO tags, browser tab title, and an emergency Open Graph share image.
2. **Standardized 3-Step Intake**: Modeled directly after the software's existing `src/features/reports` domain (`LogReportModal` and `ReportIntakeScreen`), simplified into 3 guided steps.
3. **Emergency Speed & Repeat Reporter Memory**:
   - 1-tap emergency complaint tags and 1-tap GPS coordinates.
   - Automatic persistent profile caching for repeat reporters (phone number, name, CNIC, default city) so subsequent reports take seconds.
4. **Crash & Distraction Resilience**: Continuous auto-save of active form input to `localStorage`, protecting reporters from lost progress if their device locks or they switch apps.
5. **Live Public Case Tracking (`/report/track/:reportNumber`)**: Read-only transparency showing the exact 5-stage rescue pipeline (`Logged` -> `Accepted` -> `Dispatched` -> `Attended` -> `Resolved`) with live milestone timestamps.
6. **Security & Anti-Abuse**: IP rate limiting, honeypot anti-bot shield, and privacy masking of personal contact information on public tracking pages.
7. **Design System & Copy Constraints**: Strictly zero em-dashes across all copy; 100% adherence to established design system tokens (`tokens.css`) and Phosphor icons.

---

## 2. Route Architecture & SEO Metadata

### 2.1 Route Mapping
The router in `src/app/App.tsx` handles these public endpoints:

| Route Path | View Component | Access Control | Description |
|---|---|---|---|
| `/report` | `PublicReportScreen` | Public (No login) | 3-step guided animal intake form |
| `/report/track/:reportNumber` | `PublicReportTrackScreen` | Public (No login) | Read-only live tracking view for a specific report |

Both routes are registered in `RESERVED_PUBLIC_SLUGS` (`src/shared/lib/public/slug.ts`) so they are never intercepted by shelter slug routing (`/:slug`).

### 2.2 Metadata & Head Tags
When visitors or search engines load `/report`:
* **Page & Tab Title**: `Sanctuary | Report an Animal in Distress`
* **Meta Title**: `Report an Animal in Distress | Sanctuary Animal Welfare Network`
* **Meta Description**: `Submit an animal emergency, injured stray, or cruelty report. Routed directly to frontline rescue responders with live case tracking.`
* **Open Graph Image**: `https://sanctuary.themohsinproject.org/og-report.jpg` (1200x630 emergency social card optimized for WhatsApp and social previews).
* **Twitter Card**: `summary_large_image` matching Open Graph tags.

---

## 3. Data Flow & Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Storage                       │
│                                                             │
│   localStorage.sanctuary_report_draft (Current in-progress) │
│   localStorage.sanctuary_reporter_profile (Saved contact)   │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Restores draft               │ Auto-saves
               ▼                              │
┌─────────────────────────────────────────────────────────────┐
│                    /report (3-Step Wizard)                  │
│                                                             │
│  Step 1: Situation & Animal (Category, Species, Count)      │
│  Step 2: Location & Photos (City, Area, GPS, Media)         │
│  Step 3: Contact & Review (Phone, Name, CNIC, Summary)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Submit Report (Honeypot + Validation)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Network Intake API                      │
│                                                             │
│  1. Check Honeypot (silent drop if filled)                  │
│  2. Verify Rate Limit (max 5 submissions / 15m / IP)        │
│  3. Validate Phone & CNIC (using existing domain validators)│
│  4. Insert rescue_report (status: 'logged')                 │
│  5. Save report_photos (media attachments)                  │
│  6. Generate Report Number (e.g. SANCTUARY-0142)            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Redirect with Report Number
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            /report/track/:reportNumber (Read-Only)          │
│                                                             │
│  • Pipeline Tracker: Logged ──> Accepted ──> Dispatched     │
│  • Real-time Timestamps                                     │
│  • Masked Privacy: 0300 ···· 567                            │
│  • Read-only Facts & Photos                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component & Step Specification

### 4.1 Step 1: Situation & Animal Details
* **Category Toggle**: Two chips matching software presets:
  - `Medical emergency` (default)
  - `Animal cruelty`
* **Animal Composition**:
  - `Single Animal` (default)
  - `Litter / Family` (with stepper for count and toggle for *Babies only* vs *Mother + Babies*)
  - `Multiple Animals` (with group count)
* **Species Chips**: Reuses `SPECIES_OPTIONS` from `src/features/reports/domain/rescueReports.ts`:
  - `Dog`, `Cat`, `Horse`, `Donkey`, `Bird`, `Other`
  - If `Bird` is selected: displays Avian sub-type chips (`Black Kite`, `Eagle`, `Pigeon / Dove`, `Crow`, `Owl`, `Hawk`, `Other Bird`).
  - If `Other` is selected: text field for custom species (`Goat`, `Rabbit`, etc.).
* **Life Stage**: Segmented toggle between `Adult` and `Child` (omitted if Litter is active).
* **Chief Complaint / Injury**:
  - 1-tap quick tags for high-speed triage:
    `[Hit by vehicle] [Severe bleeding] [Fractured limb] [Unable to stand] [Sick / Weak] [Trapped / Abuse]`
  - Clicking a tag populates or appends to the complaint text area.
  - Multi-line text field for additional descriptive notes.

### 4.2 Step 2: Location & Media
* **City Selection**: Dropdown populated from `PAKISTAN_CITIES` (defaults to `Lahore`, supports `Karachi`, `Islamabad`, `Rawalpindi`, `Faisalabad`, `Multan`, `Peshawar`, `Quetta`, etc.).
* **Location Area**: Autocomplete/text input supported by `getAreasForCity`.
* **Landmark**: Text input for specific visual markers (e.g., *Opposite Fresco Sweets, near underpass*).
* **1-Tap GPS Location Button**:
  - Button with Phosphor `Crosshair` icon: *"Share exact GPS location"*.
  - Calls `requestCurrentPosition()` from `src/features/reports/domain/coordinates.ts`.
  - On success: displays green confirmation badge with coordinates and map indicator.
* **Photo & Video Capture**:
  - Image uploader supporting direct mobile camera capture or photo library selection.
  - Generates local thumbnail previews with remove button.
  - Compress images using `compressImage()` before staging.

### 4.3 Step 3: Reporter Contact & Confirmation
* **Reporter Phone**:
  - Required telephone input with real-time formatting via `formatPhoneNumber()` and validation via `validatePhoneNumber()`.
  - Shows green check on valid mobile numbers (`03XX XXXXXXX`).
* **Reporter Name**: Text input (optional).
* **Reporter CNIC**: Text input with real-time formatting via `formatCnic()` and validation via `validateCnic()` (optional).
* **Persistent Profile Toggle**:
  - Checkbox: *"Remember my details on this device for future rescue reports"* (checked by default).
  - When enabled, saves contact info to `localStorage.sanctuary_reporter_profile`.
* **Review Summary Card**:
  - Clean card summarizing: Animal type, Complaint, Location, and Photos attached.
* **Submit Action**:
  - Primary button: *"Submit Emergency Report"*.
  - Displays loading state during submission.
  - On success: clears `sanctuary_report_draft`, navigates to `/report/track/:reportNumber`.

---

## 5. Public Live Case Tracker (`/report/track/:reportNumber`)

### 5.1 Visual Elements
1. **Case Header**:
   - Case tracking badge: `Case #SANCTUARY-0142`
   - Current stage pill badge: `Logged`, `Accepted`, `Dispatched`, `Attended`, or `Resolved`
   - Relative status banner: *"Report received by the rescue network. Responders are reviewing the details."*
2. **Visual Pipeline Tracker**:
   - Direct reuse of `ReportPipelineTracker` logic from `src/features/reports/components/ReportPipelineTracker.tsx`.
   - Displays all 5 pipeline nodes with completion checkmarks and timestamps.
3. **Read-Only Case Facts**:
   - Category, Species, Animal count, Complaint description.
   - City, Area, and Landmark.
   - Photos uploaded with the report (interactive thumbnail viewer).
4. **Reporter Privacy Masking**:
   - Phone displayed as `0300 ···· 567`.
   - CNIC (if provided) displayed as `42101-·······-1`.
5. **No Administrative Controls**:
   - Strictly zero admin edit buttons, stage transition triggers, or dismissal actions.
6. **Share & Bookmark Action**:
   - 1-tap *"Copy tracking link"* button with copy confirmation toast.

---

## 6. Security, Rate Limiting & Anti-Abuse

1. **Honeypot Shield**:
   - A hidden input field `<input type="text" name="sanctuary_security_trap" tabIndex={-1} autoComplete="off" />` styled with `display: none; position: absolute; left: -9999px`.
   - If filled by an automated bot, submission returns a simulated success response without executing database writes.
2. **Rate Limiting**:
   - Enforced client and edge guard limiting submissions to 5 reports per 15-minute window per IP.
3. **Payload Sanitization**:
   - Strips malicious HTML or script tags from complaint, landmark, and name fields.
4. **Image Upload Restrictions**:
   - Maximum 5 photos per report.
   - Client-side image compression down to max 1600px dimension and JPEG quality 0.82 to avoid payload overload.

---

## 7. Design System & Styling Specifications

* **Design Tokens (`src/styles/tokens.css`)**:
  - Primary Brand Green: `var(--color-brand-primary, #2F5D3A)`
  - Deep Ink: `var(--color-ink, #1A2E22)`
  - Card & Background: `var(--color-bg, #F7FAF8)` / `#FFFFFF`
  - Subtle Border: `var(--color-border, #C5D0C8)`
  - Accent / Status Badges:
    - Logged: Amber (`#FEF3E7`, text `#B45309`)
    - Accepted: Blue (`#EBF5FA`, text `#1D6F8A`)
    - Dispatched / Attended: Forest Green (`#E3EDE6`, text `#2F5D3A`)
* **Typography**:
  - Headings: `Outfit`, sans-serif (700 / 600 weight)
  - Body: `DM Sans`, sans-serif (400 / 500 / 600 weight)
  - Monospace (case codes & coords): `DM Mono`, monospace
* **Icons**: `@phosphor-icons/react` only (`Siren`, `CheckCircle`, `Crosshair`, `Camera`, `ShareNetwork`, `CaretRight`, `ArrowLeft`).
* **Zero Em-Dashes**: Guaranteed zero em-dashes (`—` or `--`) in all UI copy, error strings, and placeholders.

---

## 8. Testing & Verification Plan

1. **Unit Tests**:
   - `tests/unit/reports/publicReportScreen.test.tsx`:
     - Step 1 -> Step 2 -> Step 3 navigation and validation rules.
     - Species, Avian sub-types, and Litter count composition.
     - Draft caching: verifies typing in fields preserves data in `localStorage`.
     - Profile pre-fill: verifies existing reporter profile pre-populates step 3.
     - Honeypot trap: verifies filled honeypot drops payload without crashing.
   - `tests/unit/reports/publicReportTrackScreen.test.tsx`:
     - Renders pipeline steps with appropriate active status and timestamps.
     - Confirms sensitive phone numbers and CNICs are properly masked.
     - Verifies no administrative buttons exist.
     - Copy link button functionality.
   - `tests/unit/reports/publicReportCopy.test.ts`:
     - Automated scan confirming 0 em-dashes across all public reporting components and metadata.
2. **Full Production Build Verification**:
   - `npm run build` must complete with 0 errors and 0 warnings.
