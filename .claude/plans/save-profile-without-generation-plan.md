# Plan: Save Coffee Profile Without Immediate Recipe Generation

## Decisions Locked
- [x] Post-save UX for `Save Coffee`: stay on `/analysis` and show `Coffee saved` with CTA buttons.
- [x] Later generation from saved scanned coffee: use existing saved-coffee detail generator (`/coffees/[id]`).
- [x] Guests / feature-flag-off behavior: hide `Save Coffee` action (keep existing generation path only).

## 1. Flow + Gating
- [x] Gate save-only branch behind saved-coffee feature flag + authenticated user.
- [x] Add dedicated analysis actions: `Save Coffee` and `Save + Generate Recipe`.
- [x] Keep existing behavior unchanged behind `Save + Generate Recipe`.

## 2. Analysis Action Split
- [x] Split analysis submit logic into:
  - [x] `handleSaveProfileOnly`
  - [x] `handleSaveAndGenerate`
- [x] Reuse one shared profile payload builder so edited bean/image handling is identical.
- [x] Define save-only failure behavior: keep edits in place, show actionable error, allow retry.

## 3. Post-Save UX (Option B)
- [x] On successful `Save Coffee`, remain on `/analysis`.
- [x] Show success state: `Coffee saved`.
- [x] Show CTA buttons:
  - [x] `View Saved Coffee` → `/coffees/[id]`
  - [x] `Generate Recipe Now` → existing `/methods` flow (same current branch logic)
- [x] Prevent duplicate submission while save is pending.

## 4. Session Storage Contract
- [x] Use `POST /api/coffee-profiles` response `profile.id` for post-save CTA target.
- [x] Define exact `Save Coffee` cleanup keys in `recipeSessionStorage`:
  - [x] Clear extraction/image transient keys used by scan bootstrap.
  - [x] Do not set `confirmedBean`, `methodRecommendations`, `recipeFlowSource`, or other recipe-flow keys on save-only branch.
- [x] Preserve current storage behavior for `Save + Generate` branch.

## 5. API Contract
- [x] Keep existing `POST /api/coffee-profiles` contract (`profile`, `primary_image`, `primary_image_error`).
- [x] If UI needs stronger branching semantics, add typed `primary_image_status` (`uploaded | failed | none`) and tests.

## 6. Navigation + Later Generation Semantics
- [x] Document and enforce that later generation from saved scan uses `/coffees/[id]` detail generator.
- [x] Confirm this is an intentional product difference from scan-time recommendation flow.

## 7. Validation + Behavior
- [x] Saving profile must work independently of recipe generation service availability.
- [x] Image upload errors remain visible (`primary_image_error`) and non-blocking for profile save.
- [x] Duplicate profile strategy for save-only path is defined (allow duplicates for now).

## 8. Tests
- [x] API/contract:
  - [x] Guest and feature-flag-off states do not expose save-only route path in UI.
  - [x] `POST /api/coffee-profiles` returns usable `profile.id` and image error semantics.
- [ ] Analysis branch tests:
  - [ ] `Save Coffee` branch saves profile only.
  - [ ] `Save Coffee` branch does not set recipe-flow session keys.
  - [ ] `Save Coffee` branch shows success + CTAs on `/analysis`.
  - [ ] `Generate Recipe Now` CTA from success state follows current `/methods` flow.
- [ ] Regression:
  - [ ] Existing scan → generate path unchanged.
  - [x] Saved profile behavior still respects feature flag and auth gating.

## 9. Docs + Release
- [x] Update product flow notes and QA checklist.
- [x] Add changelog entry.
- [x] Bump `package.json` version (likely patch/minor based UI scope).

## 10. Staging Rollout
- [ ] Verify with `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES=true` in staging.
- [ ] Validate both branches (`Save Coffee` vs `Save + Generate`) end-to-end.
- [ ] Confirm no regression in existing recipe generation funnel metrics.
