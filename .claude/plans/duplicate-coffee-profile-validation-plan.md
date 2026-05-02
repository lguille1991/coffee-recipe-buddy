# Duplicate Coffee Profile Validation Plan

## Decisions Locked
- [x] Scope for this iteration: analysis scan flow only (current caller of `POST /api/coffee-profiles`).
- [x] Duplicate detection is per-user only.
- [x] Check only active profiles (`archived_at is null`).
- [x] Exact-match fields are `label`, `bean_profile_json.roaster`, `bean_profile_json.bean_name`, `bean_profile_json.origin`, `bean_profile_json.process`, `bean_profile_json.roast_level`.
- [x] Hard-block exact duplicates.
- [x] Default UX action is `Use Existing`.

## 1. Define Canonical Duplicate Criteria
- [x] Strict duplicate key fields: `label`, `bean_profile_json.roaster`, `bean_profile_json.bean_name`, `bean_profile_json.origin`, `bean_profile_json.process`, `bean_profile_json.roast_level`.
- [x] Normalize each key using deterministic rules:
- [x] trim leading/trailing whitespace
- [x] collapse internal whitespace to one space
- [x] lowercase
- [x] do not apply punctuation normalization in v1
- [x] Normalize missing optional fields (`roaster`, `bean_name`, `origin`) to empty string before comparison.
- [x] Duplicate rule: exact match across all normalized key fields.
- [x] Archived behavior: active-only comparison.
- [x] Define deterministic multi-match tie-breaker for existing duplicates:
- [x] prefer most recently updated (`updated_at` desc), then `created_at` desc.

## 2. Add Shared Duplicate-Detection Utility
- [x] Create `src/lib/coffee-profile-duplicates.ts` to hold canonicalization and duplicate comparison helpers.
- [x] Export typed helper(s) used by API routes and tests (no UI-only logic).
- [x] Keep logic deterministic and side-effect free for easy unit testing.
- [x] Export fingerprint builder used by create and update paths.

## 3. Extend API Contract (Create Profile)
- [x] Update `src/app/api/coffee-profiles/route.ts` `POST` flow to run duplicate detection before insert.
- [x] For exact duplicate, return structured duplicate-block payload (`409`) with `status: 'duplicate_blocked'`.
- [x] Include lightweight duplicate candidates in response (`id`, `label`, key bean fields, `created_at`) for UI decisions.
- [x] Preserve existing image upload behavior and ensure no upload runs when create is blocked.
- [x] On DB unique violation fallback, map DB error to same typed `duplicate_blocked` response shape.

## 4. Add UI Warning Flow in Analysis Save Path
- [x] Update `src/app/analysis/page.tsx` `saveCoffeeProfile()` handling for duplicate-block response.
- [x] Show warning modal/sheet with:
- [x] existing profile summary,
- [x] explicit user choice: `Use Existing` (default), `Cancel`.
- [x] If user chooses `Use Existing`, persist selected `profileId` in current flow state.
- [x] Define `Cancel` semantics:
- [x] `Save Coffee` path: abort save and keep user on analysis page.
- [x] `Save + Generate Recipe` path: abort generation and keep user on analysis page.
- [x] Define `Use Existing` semantics:
- [x] `Save Coffee` path: treat as save success, set `savedProfileId` to existing id.
- [x] `Save + Generate Recipe` path: auto-resume generation using existing `profileId`.
- [ ] Add explicit multi-match UI:
- [ ] if multiple candidates returned, default-select tie-break winner and allow user to pick another.

## 5. Wire Reuse Through Generation Path
- [x] Extend session state (`recipeSessionStorage`) to store optional selected `coffee_profile_id` for downstream generation.
- [x] Update methods flow to branch:
- [x] if `coffee_profile_id` exists, use `/api/recipes/from-profile`.
- [x] otherwise keep current `/api/generate-recipe` path.
- [x] Ensure reused-profile generation links recipe to profile and updates `last_used_at`.
- [x] Clear persisted `coffee_profile_id` after generation/save completion and on cancellation.

## 6. Schema & Type Updates
- [x] Add typed API response union for `created | duplicate_blocked | error` to avoid fragile string checks in UI.
- [x] Update callers to parse typed outcome safely.
- [x] Keep response naming aligned with hard-block semantics (no `warning` label).

## 7. Data-Layer Hardening (Required for Hard-Block Guarantee)
- [x] Add normalized fingerprint column via migration (e.g., `duplicate_fingerprint text not null`).
- [x] Backfill fingerprint for existing rows.
- [x] Run pre-index duplicate audit and resolution plan for active rows that already collide.
- [x] Add per-user partial unique index for active rows:
- [x] unique (`user_id`, `duplicate_fingerprint`) where `archived_at is null`.
- [x] Add supportive lookup index for read path performance if needed.
- [x] Update create and patch handlers to recompute fingerprint from normalized fields.

## 8. Tests
- [x] Add unit tests for canonicalization/comparison in `src/lib/__tests__/coffee-profile-duplicates.test.ts`.
- [ ] Add route tests in `src/app/api/coffee-profiles/route.test.ts` for:
- [x] exact duplicate hard-block (`409`),
- [x] non-duplicate create success,
- [ ] active-only duplicate semantics (archived rows ignored).
- [x] missing optional fields normalized to empty-string behavior.
- [ ] duplicate request with `image_data_url` does not attempt upload.
- [ ] DB unique violation maps to typed `duplicate_blocked` contract.
- [ ] Add API tests for patch recomputing fingerprint and enforcing uniqueness.
- [ ] Add UI behavior tests for `saveCoffeeProfile()` duplicate response handling.
- [ ] Add UI tests for `Save + Generate` reuse flow and cancel flow.
- [ ] Add UI tests for multi-candidate duplicate selection.

## 9. Rollout & Observability
- [ ] Add server logs/metrics for duplicate detection outcomes (blocked duplicate, user reused existing).
- [x] Validate no regression for save-and-generate flow when duplicate block occurs.
- [x] Update `CHANGELOG.md` with user-facing note about duplicate profile warnings.
- [x] Bump `package.json` version (likely `MINOR` if new user-visible flow).

## 10. Acceptance Criteria
- [ ] Concurrent create requests cannot produce active duplicates for the same user and key.
- [x] Duplicate-block responses are typed consistently as `duplicate_blocked`.
- [x] `Use Existing` links downstream generated recipes to the selected profile and updates `last_used_at`.
- [x] `Cancel` never triggers profile creation or recipe generation.
- [x] Existing non-profile generation path continues to work unchanged when no `coffee_profile_id` is selected.
