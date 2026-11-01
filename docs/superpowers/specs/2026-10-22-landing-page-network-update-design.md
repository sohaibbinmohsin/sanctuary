# Sanctuary Landing Page Redesign: Animal Welfare Network

**Date:** 2026-10-22  
**Status:** Draft / Proposed  
**Branch:** `feat/landing-page-network-update`  
**Target:** `src/features/landing/LandingScreen.tsx`, `src/features/landing/landing.css`, `src/features/auth/screens/LoginScreen.tsx`

---

## 1. Context & Motivation

Sanctuary has expanded beyond single-shelter management. It now serves as an animal welfare network connecting citizens, frontline rescue teams, shelters, clinics, and pet guardians on a shared operational backbone.

User feedback highlighted two core needs:
1. People visiting the landing page must immediately grasp what Sanctuary does for them without needing to decipher business models or complex terminology.
2. The primary call-to-action must be actionable: allowing anyone to report an animal in distress directly, routing reports to local partner rescue networks.
3. Replace developer/tech jargon like "playground" with clear, accessible language like "interactive demo", and position that option on the sign-in screen.

---

## 2. Design Foundations & Constraints

* **Design System Tokens:** Strict adherence to existing CSS custom properties in `src/styles/tokens.css` (e.g. `--color-brand-primary`, `--color-forest-soft`, `--color-surface-card`, `--radius-md`, `--space-*`). No arbitrary colors or unapproved fonts.
* **Tone & Language:** Clear, grounded, and human-centered. No tech hype or premature AI feature claims.
* **Punctuation Standard:** No em-dashes in any user-facing copy.
* **Icons:** High-quality Phosphor icons (`@phosphor-icons/react`), specifically the `Siren` icon for the emergency report action. No emojis in UI buttons.

---

## 3. Page Structure & Section Breakdown

### A. Topbar
* **Brand Lockup:**
  * Logo: `/sanctuary-logo.svg`
  * Title: **Sanctuary**
  * Subheadline: **Animal welfare network** (updated from "Animal welfare platform")
* **Action:** Direct link to `Sign in` (`/login`).

### B. Hero Section
* **Kicker:** The Animal Welfare Network
* **Headline:** Connecting everyone who protects animals.
* **Lede:** A shared digital backbone for rescuers, shelters, veterinarians, and animal guardians. Report animals in distress, manage daily care, and coordinate rescues, even without internet signal.
* **Actions:**
  * **Primary CTA:** Button with Phosphor `Siren` icon and text `Report a case`. Opens the report intake flow or links to `/reports/new`.
  * **Secondary CTA:** Button with text `Sign in` linking to `/login`.
* **Visual Anchor:** Subtle, authentic field care photography with high contrast overlay.

### C. "Built for Everyone Protecting Animals" (Stakeholder Pillars)
A five-card audience breakdown communicating concrete value for each role:
1. **Citizens and Advocates:**
   * *Icon:* MegaphoneSimple or HandHeart
   * *Copy:* Spot an animal in distress and submit a rescue report in seconds with photos and location. No lost chat threads or forgotten cases.
2. **Field Rescue Teams:**
   * *Icon:* Ambulance or NavigationArrow
   * *Copy:* Receive dispatched reports, capture GPS coordinates and field photos on the spot, and work seamlessly without cellular signal.
3. **Shelters and Sanctuaries:**
   * *Icon:* HouseLine or Cat
   * *Copy:* Manage animal profiles, track daily headcounts, run feeding and medical checklists, and maintain transparent expense records.
4. **Veterinarians and Clinics:**
   * *Icon:* FirstAid or Heartbeat
   * *Copy:* Record treatments, vaccinations, and recovery milestones with a permanent health history that stays with the animal.
5. **Pet Guardians and Owners:**
   * *Icon:* ShieldCheck or IdentificationBadge
   * *Copy:* Keep digital vaccination and medical records in one secure place, with rapid community alerts if a pet ever goes missing.

### D. "Built to Work Where You Work" (Platform Strengths)
A clean, grounded feature overview:
1. **Works Offline Anywhere:** Local-first database that functions in basements, rural sanctuaries, and remote roads, syncing automatically when back online.
2. **Connected Care Chain:** Seamless handoffs from street report to clinic treatment, shelter rehabilitation, and adoption.
3. **Auditable Ledger:** Transparent tracking of medicine costs, food supplies, and medical bills for trusted donor accountability.
4. **Your Data Stays Yours:** Export your records anytime. Free software with no vendor lock-in.

### E. Trusted Partner Directory (The Coalition)
Maintains and elevates the full coalition of partner organizations to build collective trust across the ecosystem:
* **Featured Partners:** ACF Animal Rescue, CDRS Bennu, Police Animal Rescue Center (PARC), Gaza Animal Rescues, Chiragh Ghar Animal Rehab, NUST Stray Animals Club (NSAC).
* **Metadata Tags:** Category pills (Shelter, Field Rescue, Police Partner, Campus) and location context.
* **External Links:** Direct links to inspect each partner's real-world rescue work.

### F. Built by The Mohsin Project
Updated copy honoring the open public utility ethos:
* *Heading:* Built by The Mohsin Project
* *Body:* The Mohsin Project builds public digital utilities for changemakers at zero cost. Sanctuary is our animal welfare network: uniting frontline rescuers, shelters, and communities on open, modern infrastructure so bad tech never blocks the work that matters.

### G. Sign-in Screen Demo Access
* In `src/features/auth/screens/LoginScreen.tsx`, provide a clear, inviting option: **"Want to explore first? Try the interactive demo"** with direct navigation to `/playground`.

---

## 4. Technical Implementation Details

1. **Component Updates:**
   * `src/features/landing/LandingScreen.tsx`: Implement the revised semantic markup, updated copy, Phosphor `Siren` icon on the primary CTA, and 5-pillar cards.
   * `src/features/landing/landing.css`: Responsive CSS grid for stakeholder cards, mobile breakpoints, typography adjustments using existing design tokens.
   * `src/features/auth/screens/LoginScreen.tsx`: Add the interactive demo link beneath the login form.
2. **Verification & Build:**
   * Run full Vitest suite to ensure no regressions.
   * Run full production build (`npm run build`) ensuring 0 errors and 0 warnings.
