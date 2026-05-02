# Archive Guard + Restore Flows Plan (Execution-Ready)

## Goal
- Allow users to archive coffee profiles after linked recipes have been soft-deleted in the UI (`recipes.archived = true`), while still blocking archive when active linked recipes exist.
- Add restore flows so users can bring recipes and coffee profiles back to active state.

## Success Criteria
- [ ] Archiving a coffee profile succeeds when all linked recipes are soft-deleted (`archived = true`).
- [ ] Archiving a coffee profile is blocked (`409`) when at least one linked active recipe exists (`archived = false`).
- [ ] Soft-deleted recipes can be listed and restored to active (`archived=false`).
- [ ] Recipe restore is blocked (`409`) when linked `coffee_profile_id` points to an archived coffee profile.
- [ ] Archived coffee profiles can be listed and restored to active (`archived_at=null`) when constraints allow.
- [ ] API behavior remains correct for feature-flag disabled, unauthorized, not found, query-failure, duplicate/conflict, and state-mismatch paths.
- [ ] DB-level enforcement and API checks are consistent.
- [ ] Test coverage validates archive + listing + restore semantics and error mapping.

## Scope
- [ ] Update DB-side coffee-profile archive guard logic so archived recipes do not block archive.
- [ ] Update `POST /api/coffee-profiles/[id]/archive` guard query to count only active linked recipes.
- [ ] Fix archived coffee-profile listing semantics in `GET /api/coffee-profiles`.
- [ ] Add archived recipe retrieval path for restore UI.
- [ ] Add recipe restore endpoint behavior.
- [ ] Add coffee profile restore endpoint behavior.
- [ ] Add/expand tests for archive, archived listing, and restore flows.
- [ ] Update release bookkeeping required by repo policy.

## Non-Goals
- [ ] No migration from recipe soft-delete to hard-delete.
- [ ] No change to existing archive endpoint URLs.
- [ ] No full UI redesign (only scoped controls/copy for archive/restore actions).

## API/State Contract Decisions
- [ ] State mismatch uses scoped-update semantics (`404`):
- [ ] Archive profile endpoint returns `404` if already archived or not found.
- [ ] Recipe restore endpoint returns `404` if already active or not found.
- [ ] Coffee profile restore endpoint returns `404` if already active or not found.
- [ ] Recipe restore endpoint returns `409` when linked coffee profile is archived; response instructs restoring coffee profile first.
- [ ] Coffee profile restore duplicate conflict maps to `409` and preserves existing `duplicate_blocked` payload shape.
- [ ] Archive-trigger DB conflict maps to `409` using explicit discriminator:
- [ ] Trigger raises SQLSTATE `P0001` with exact message `Cannot archive coffee profile while it is linked to existing active recipes`.
- [ ] Route maps `P0001` + exact message to `409`.

## Implementation Steps

### 1. Reconfirm route and DB contracts
- [ ] Re-read `src/app/api/coffee-profiles/[id]/archive/route.ts` current behavior.
- [ ] Re-read trigger function in `docs/migration_009_coffee_profiles.sql`.
- [ ] Reconfirm recipe list/detail paths currently hard-filter active (`archived=false`).
- [ ] Reconfirm `GET /api/coffee-profiles` currently applies `limit` before in-memory archived filtering.

### 2. Update DB-side archive guard to match product semantics
- [ ] Add a new migration SQL file under `docs/` that updates `public.prevent_archiving_linked_coffee_profiles()`.
- [ ] In trigger function `EXISTS` clause, add active filter equivalent to `r.archived = false`.
- [ ] Keep trigger name and invocation intact (`coffee_profiles_prevent_archive_if_linked`).
- [ ] Update trigger exception message to `Cannot archive coffee profile while it is linked to existing active recipes` and raise SQLSTATE `P0001`.
- [ ] Add deployment notes in migration header:
- [ ] apply migration before (or in same wave as) app code relying on new behavior,
- [ ] app rollback does not revert DB migration,
- [ ] include reverse migration SQL snippet or explicit forward-only rollback note.

### 3. Update API preflight + conflict mapping in coffee-profile archive route
- [ ] In `src/app/api/coffee-profiles/[id]/archive/route.ts`, linked-recipe count query includes:
- [ ] `.eq('user_id', user.id)`
- [ ] `.eq('coffee_profile_id', id)`
- [ ] `.eq('archived', false)`
- [ ] Keep count strategy (`head: true`, `count: 'exact'`).
- [ ] Map DB-trigger conflict to `409` using `P0001` + exact message match.
- [ ] Keep `404` only for scoped state mismatch/not-found update result.
- [ ] Retain `500` for unrelated database errors.

### 4. Fix archived coffee-profile listing behavior
- [ ] Update `src/app/api/coffee-profiles/route.ts` so archive-state filtering is done in SQL before `limit`:
- [ ] active view: `.is('archived_at', null)`.
- [ ] archived view: `.not('archived_at', 'is', null)` or equivalent.
- [ ] Keep ordering/pagination semantics consistent after SQL-level filtering.
- [ ] Add tests to verify completeness for both `archived=false` and `archived=true` views under limit.

### 5. Add archived recipe retrieval path for restore UI
- [ ] Extend recipe listing contract to support archived retrieval (recommended: `GET /api/recipes?archived=true`).
- [ ] Add `archived` option to `listRecipesForUser` and adapt query filter accordingly.
- [ ] Keep recipe detail route active-only.
- [ ] Ensure archived recipe list is owner-scoped and pagination/search semantics remain consistent.

### 6. Add recipe restore API flow
- [ ] Add endpoint (recommended: `POST /api/recipes/[id]/restore`).
- [ ] Implement restore logic with scoped update (`archived=true -> false`) for user-owned row.
- [ ] Before restore, if recipe has linked `coffee_profile_id`, verify linked coffee profile is active (`archived_at IS NULL`).
- [ ] If linked coffee profile is archived, return `409` with explicit guidance to restore coffee profile first.
- [ ] Return `404` for state mismatch/not-found.
- [ ] Return `200` with restored recipe payload.
- [ ] Confirm restored recipes reappear in active list and are excluded from archived list.

### 7. Add coffee profile restore API flow
- [ ] Add endpoint (recommended: `POST /api/coffee-profiles/[id]/restore`).
- [ ] Implement restore logic with scoped update (`archived_at IS NOT NULL -> NULL`) for user-owned row.
- [ ] Return `404` for state mismatch/not-found.
- [ ] On `23505`, perform follow-up duplicate lookup using same duplicate-fingerprint + candidate selection pattern used in `src/app/api/coffee-profiles/[id]/route.ts` PATCH flow.
- [ ] Return `409` with existing `duplicate_blocked` payload shape (`candidates`, `selected_candidate_id`).
- [ ] Return `200` with restored profile payload when no conflict.
- [ ] Declare dependency: active-duplicate unique index from `docs/migration_010_coffee_profile_duplicate_fingerprint.sql` must be present.

### 8. Add UI entry points for restore with explicit file scope
- [ ] Recipes list UI:
- [ ] `src/app/recipes/page.tsx`: add `archived` query param parsing/passthrough.
- [ ] `src/app/recipes/RecipesClient.tsx`: preserve `archived` in URL state and load-more requests.
- [ ] Add “Archived recipes” toggle/view and per-recipe restore action.
- [ ] Archived recipe cards must be non-link restore rows (no `/recipes/[id]` navigation while archived).
- [ ] Update `src/components/RecipeListCard.tsx` with explicit archived-mode behavior.
- [ ] Coffee profiles UI:
- [ ] `src/app/coffees/SavedCoffeesClient.tsx`: add archived toggle/view consuming `?archived=true`.
- [ ] Archived/active toggle state for coffees is URL-backed (mirror recipes behavior for refresh/back-button consistency).
- [ ] `src/app/coffees/[id]/SavedCoffeeDetailClient.tsx`: add restore action if detail view supports archived profiles.
- [ ] Keep hard-delete actions visually separate and explicitly irreversible.

### 9. Expand and refactor tests
- [ ] Archive route tests: feature-flag `404`, unauthorized `401`, count-query `500`, active-linked `409`, archived-only linked `200`, state mismatch `404`, DB-trigger conflict `409`.
- [ ] Refactor archive route mocks for three `.eq()` chain.
- [ ] Coffee profiles list tests: SQL-level archive filtering correctness under limit.
- [ ] Recipes list tests: `archived=true/false` behavior and pagination/filter consistency.
- [ ] Recipe restore tests: unauthorized, state mismatch/not-found, linked archived profile conflict `409`, success after linked coffee profile restore.
- [ ] Coffee profile restore tests: feature-flag off, unauthorized, state mismatch/not-found, duplicate conflict payload shape, success.
- [ ] Repeated archive/restore request tests to enforce state-mismatch contract.

### 10. Add end-to-end behavioral validations (or explicit follow-up)
- [ ] Scenario A: linked recipe exists -> soft-delete recipe -> archive profile succeeds.
- [ ] Scenario B: archive recipe -> recipe appears in archived list -> restore blocked if linked profile archived -> restore profile -> restore recipe -> recipe appears in active list.
- [ ] Scenario C: archive coffee profile -> profile appears in archived list -> restore profile -> appears in active list.
- [ ] If infra cannot support these now, create named follow-up issues and link in completion notes.

### 11. Consistency checks across related flows
- [ ] Confirm recipe delete endpoints remain soft-delete by design.
- [ ] Confirm hard-delete coffee profile endpoint remains independent from archive/restore flow.
- [ ] Optional: align 409 copy with “active recipes” phrasing.

### 12. Release bookkeeping (repo requirement)
- [ ] Bump `package.json` version with MINOR increment.
- [ ] Add user-facing entries to `CHANGELOG.md` for:
- [ ] archive behavior fix,
- [ ] archived listing + restore capability for recipes and coffee profiles,
- [ ] restore-block behavior when parent coffee profile is archived.

### 13. Verification before merge
- [ ] Run targeted tests for modified archive/listing/restore routes and UI.
- [ ] Run lint/typecheck for touched files.
- [ ] Validate manual scenarios for archive conflict, archived listing visibility, restore success, and duplicate restore conflict payload.

## Risk Assessment
- [ ] Medium risk: behavior change spans DB trigger, archive route, list filtering, restore endpoints, and UI controls.
- [ ] Main regression risk: mismatch between API and DB constraints or inconsistent state-mismatch behavior.
- [ ] Mitigation: enforce explicit contracts and test each layer.

## Rollout Plan
- [ ] Deployment order:
- [ ] apply DB migration first (or same wave before exposing restore/archive UI),
- [ ] deploy API changes,
- [ ] deploy UI changes.
- [ ] Rollback posture:
- [ ] app rollback does not revert DB migration,
- [ ] keep reverse migration SQL or forward-only remediation notes prepared.
- [ ] Monitor archive/restore/list endpoints (status distribution + errors) for 24-48h.

## Deliverables
- [ ] Updated archive route + conflict mapping.
- [ ] New migration file for trigger behavior and SQLSTATE/message contract.
- [ ] Fixed archived coffee-profile listing behavior in API.
- [ ] Archived recipe listing support in recipes API/library.
- [ ] New restore route(s) for recipes and coffee profiles.
- [ ] Expanded tests for archive + listing + restore flows.
- [ ] UI restore entry points for archived recipes and archived coffee profiles.
- [ ] `package.json` MINOR version bump.
- [ ] `CHANGELOG.md` user-facing notes.
