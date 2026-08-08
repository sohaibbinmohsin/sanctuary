# Sanctuary Design System

**Mode:** Redesign overhaul (IA preserved, visual language new)  
**Theme:** Light only  
**Dials:** VARIANCE 5 · MOTION 4 · DENSITY 5

## Design Read

Reading this as: redesign-overhaul of a mobile-first shelter ops PWA for sanctuary caregivers, with a calm field-tool language, leaning toward Soft UI Evolution + Forest palette and custom CSS primitives.

## Palette

| Token | Hex | Role |
|-------|-----|------|
| `--color-ink` | `#1A2E22` | Primary text |
| `--color-ink-muted` | `#4A5C50` | Secondary text |
| `--color-forest` | `#2F5D3A` | Primary actions, brand |
| `--color-forest-soft` | `#E3EDE6` | Soft fills, active nav |
| `--color-mist` | `#E8EEE9` | Page background |
| `--color-surface` | `#F7FAF8` | Panels / inputs |
| `--color-white` | `#FFFFFF` | Elevated surfaces |
| `--color-amber` | `#B45309` | Single accent (urgency CTAs) |
| `--color-danger` | `#B42318` | Destructive |
| `--color-border` | `#C5D0C8` | Borders |
| `--color-ring` | `#2F5D3A` | Focus |

## Typography

- Display: Outfit 600–700 (brand, page titles)
- Body: DM Sans 400–600
- Utility / IDs: DM Mono 500 (shelter codes)

## Signature

Monospace shelter-code stamp on animal cards and detail headers.

## Layout

- Mobile: bottom icon nav + safe areas
- Desktop (`lg` 1024+): left sidebar, content max-width ~1120px, split panels where useful
- Radius: 10px controls, 14px panels
- Motion: 180–280ms ease; list stagger; honor `prefers-reduced-motion`

## Copy voice

Plain verbs, sentence case, no jargon. Name things by what caregivers do: Add animal, Log care, Money, Overview. Errors explain what to try next. No em-dashes in UI copy.

## Out of scope

Dark mode (v1). Marketing landing patterns on product screens.
