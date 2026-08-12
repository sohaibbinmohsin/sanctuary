# Multi-Status & Daily Checklist Design

**Date:** 2026-08-12  
**Product:** Sanctuary — shelter management software by The Mohsin Project  
**Status:** Approved for implementation planning  

**Related:** Extends MVP animal status (single `status_id`) and Overview. Does not add a fifth primary nav item.

---

## 1. Purpose & success

Staff need animals to carry **more than one lasting status** at once (e.g. Critical and another care label), and a **shared daily checklist** so a large herd (20–300+) is not missed. Checklist membership is curated from the animal list (filter → select → add), not inferred only from status.

**Success:**
- An animal can have multiple statuses (UI still says **Status**); list/detail show them as badges/chips.
- Out-of-care (exit) statuses are exclusive: confirm → other statuses cleared.
- In-care headcount: ≥1 in-care status and **no** out-of-care status (“exit wins”).
- Filters live on their own page (search-bar filter icon); status match mode **Match any selected** (default) / **Match all selected**; filtering is **SQL/PowerSync**, not client-only.
- **Add to checklist** select mode merges animals into one org-shared list; remove only on the checklist page.
- Checklist items persist until removed; checkmarks reset each local calendar day; missed days show on Overview (badge + count) and via device push (evening same day + morning if still overdue).
- Overview shows a compact checklist (≤5 rows); full page at `/checklist`. Mobile bottom nav and desktop sidebar stay at four items.

**Primary audience:** shelter operators running daily care rounds.

---

## 2. Goals & non-goals

### Goals

- Many-to-many animal ↔ status assignments; migrate from single `status_id`
- Keep product language **Status** (multi-select under the hood)
- Exit-status confirm on animal edit; Settings confirm when flipping a status to out-of-care if animals also have other statuses (strip extras only on confirm)
- Filters page; freed list chrome for **Add to checklist**
- Org-shared checklist; daily checks; overdue tracking; Overview snippet + `/checklist`
- Web Push: evening (unchecked today) + morning (prior-day overdue); Overview badge works without permission
- Offline-first for assignments, checklist add/check/remove (push online-only)

### Non-goals

- Renaming “Status” to Tags/Labels/Flags in UI
- Undo / automatic restore after mistaken exit (confirm is enough; care log remains the history)
- Personal per-member checklists (shared now; personal later)
- Fifth nav tab for Checklist
- Auto-adding animals to checklist from status alone
- Client-side filter over the full herd in memory
- Guaranteeing iOS PWA push reliability (manual device check; fail soft)

---

## 3. Architecture

```text
Animals list
  Search + filter icon → Filters page → SQL-filtered list
  Add to checklist → select mode → merge checklist_items

Animal detail / intake
  Multi-select Status chips
  Out-of-care pick → confirm → sole exit assignment
  Status set change → care-log status note (label list)

Overview
  Headcount (exit-wins rule)
  Checklist card (≤5, overdue badge) → /checklist

Checklist page
  Check/uncheck today, remove, missed-day UI
  Optional: enable push reminders

Push (last slice)
  Evening + morning schedules → OS notification → /checklist
```

| Piece | Role |
|--------|------|
| `animal_statuses` | Unchanged org catalog (label, sort, counts_as_in_care, archived) |
| `animal_status_assignments` | Many-to-many; replaces `animals.status_id` |
| `checklist_items` | Org-shared membership until removed |
| `checklist_checks` | Per animal per local `YYYY-MM-DD` when checked |
| Filters page | Criteria only; queries run in DB |
| Overview + `/checklist` | Surfaces; no new primary nav |
| Web Push | Last slice; badge/count is source of truth if push unavailable |

**Nav:** Animals, Money, Overview, Settings only. Checklist is nested under Overview (and push deep link).

---

## 4. Data model

### 4.1 Status assignments

- Table `animal_status_assignments`: `id`, `org_id`, `animal_id`, `status_id`, `created_at` (unique on `animal_id` + `status_id`).
- Migration: for each animal with `status_id`, insert one assignment; then stop relying on `animals.status_id` (drop or leave unused after backfill — implementation plan picks one; app reads assignments only).
- **Required:** every non-archived animal has ≥1 assignment.
- **In care:** exists assignment to status with `counts_as_in_care = 1`, and **no** assignment to status with `counts_as_in_care = 0`.
- **Exit write path:** after confirm, delete other assignments for that animal; keep only the chosen out-of-care status. An animal may have **at most one** out-of-care status; picking an exit clears all other assignments (including any previous exit).
- **Care history:** on assignment set change, append treatment `status` with notes = comma-separated labels (sorted by status `sort_order`). No separate undo stack.

### 4.2 Settings reclassification

- `counts_as_in_care` remains on the status definition; headcount reads it live.
- Turning **counts as in care** **off**: if any animals have that status **and** at least one other status → single confirm before apply: save as out-of-care **and** strip the other statuses on those animals. **Cancel aborts the whole change** (flag and assignments stay as they were). If no animals have extras, save the flag with no assignment rewrite.
- Turning **on**: no assignment rewrite.

### 4.3 Checklist

- `checklist_items`: `id`, `org_id`, `animal_id`, `added_at`, optional `added_by`; unique `(org_id, animal_id)`.
- `checklist_checks`: `id`, `org_id`, `animal_id`, `check_date` (local calendar date string), `checked_at`, optional `checked_by`; unique `(org_id, animal_id, check_date)`.
- **Add:** insert missing items only (merge).
- **Remove:** delete `checklist_item` only on checklist page; retain historical `checklist_checks` for missed-day analytics while useful; UI only lists current items.
- **Checked today:** presence of check row for today’s local date.
- **Overdue / missed:** while on the list, count consecutive local calendar days **ending yesterday** with no `checklist_checks` row (streak starts from `added_at` date or day after last check). Overview overdue **count** = animals with streak ≥ 1; rows show e.g. “2 days missed.” Exact SQL belongs in the implementation plan.
- **Archive animal:** delete that animal’s `checklist_items` row (checks history may remain).

### 4.4 Sync

- New tables in PowerSync schema; org-scoped like animals.
- Offline: assignments + checklist mutations local; push only when online and permission granted.

---

## 5. Product surfaces

### 5.1 Animals list

- Search bar; **filter icon** at the right (active when filters applied).
- **Add to checklist** in the space freed by moving filter pills off the list.
- Tap **Add to checklist** → select mode: Select all (**current filtered result set only**, via the same SQL query — not an unfiltered herd), per-card toggle, Confirm / Cancel.
- Confirm merges selection; toast with added count (and optionally how many already present).
- Cards: multiple status badges by `sort_order`; overflow (e.g. `+2`) if needed.

### 5.2 Filters page

- Route under animals (e.g. `/animals/filters`).
- Multi-select statuses + existing species/sex (and any current filters).
- Status mode toggle labels: **Match any selected** / **Match all selected** (default any).
- Apply → list with SQL predicates; Clear resets.
- Must not load the full herd into the client to filter.

### 5.3 Animal detail / intake / edit

- Status = multi-select chips.
- Selecting an out-of-care status → confirm that all other statuses will be removed → on OK, exit only.
- No post-exit Undo control in this pass.

### 5.4 Overview

- Headcount uses §4.1 in-care rule.
- Checklist card: up to **5** rows (prefer unchecked/overdue first), overdue badge/count, **View all** → `/checklist`.

### 5.5 Checklist page (`/checklist`)

- Full list: check/uncheck for today, remove, missed-day indicator.
- Empty state → Animals → Add to checklist.
- Entry point for enabling push reminders when overdue exists / user opts in.

### 5.6 Settings

- Status editor unchanged in spirit; document that `counts_as_in_care = false` means out-of-care/exit for exclusivity and headcount.
- Confirm flow on reclassify to out-of-care when animals have extra statuses (§4.2); cancel aborts flag + strip together.

---

## 6. Notifications

- **In-app:** Overview overdue badge + count (always).
- **Device push (required in this design, last implementation slice):**
  - Evening: any checklist animal still unchecked **today**.
  - Morning: any still overdue from **prior** day(s).
  - Opens `/checklist`.
- Permission denied: no repeated every-launch nag; explicit enable from Overview/Checklist; badge remains.
- Fail soft if scheduling/push unavailable; UI overdue is source of truth.

---

## 7. Error handling & edge cases

| Case | Behavior |
|------|----------|
| Exit status without confirm | No write |
| Settings out-of-care confirm cancelled | Flag and assignments unchanged |
| Save with zero statuses | Blocked — ≥1 required |
| Archived status in picker | Hidden; existing assignments still display |
| Add with empty selection | Confirm disabled or no-op + message |
| Duplicate add | Skip; optional toast |
| Animal archived | Checklist item deleted |
| Local midnight | Items remain; all show unchecked for new day |
| Uncheck today | Deletes today’s check row |
| Offline mutations | Allowed for data; push deferred |
| Push permission denied | Badge only |

---

## 8. Testing

**Unit:** in-care / exit-wins; exit clears others; Settings strip-on-confirm; filter any vs all in SQL fixtures at scale-shaped data; checklist merge; daily reset; overdue count; archive removes item.

**UI smoke:** filters → list; select mode → Overview + `/checklist`; multi badges; exit confirm; Overview ≤5 + navigation.

**Push:** mocked evening/morning; deep link; denied permission path.

**Manual:** real-device push (esp. iOS PWA) — not a CI gate.

---

## 9. Phasing (within Approach 1)

1. Assignments schema + migration + multi-select UI + exit confirm + SQL filters page + in-care rule  
2. Checklist tables + Add to checklist + Overview snippet + `/checklist` + overdue UI  
3. Settings reclassify confirm  
4. Web Push evening + morning  

Personal checklists are explicitly later, outside this spec.

---

## 10. Open points for implementation plan (not product TBD)

- Exact PowerSync/Supabase migration steps and whether to drop `animals.status_id` in the same migration  
- Precise missed-day streak SQL  
- Push provider / VAPID / service-worker details and quiet hours timezone (device local for pilot)  
- Badge overflow threshold on animal cards  
