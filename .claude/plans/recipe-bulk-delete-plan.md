# Recipe Bulk Delete Action Plan

## Goals
- [x] Add a bulk action flow on `/recipes` so users can select multiple recipes and soft-delete them (`archived = true`) in one action.
- [x] Keep UX safe via explicit destructive confirmation and clear selection feedback.
- [x] Keep client/server list state coherent after deletion by combining local reconciliation with server refresh.

## Locked Product + Technical Decisions
- [x] Scope: bulk delete applies only to currently loaded recipes (not unloaded pages/results).
- [x] Include `Select all visible` in v1.
- [x] Keep confirm-only behavior in v1 (no undo).
- [x] `Select all visible` must always work for loaded items: remove the prior low request cap and use a high safe cap in validation.
- [x] Bulk API must return concrete `archived_ids` so client reconciliation is exact.
- [x] After successful delete, remove archived IDs locally, then run `router.refresh()` to re-sync pagination/list state.
- [x] In selection mode: disable `Load more`; changing search/filter exits selection mode and clears selection.
- [x] Harden existing single-delete route in same change to scope by `user_id` and `archived = false`.
- [x] `ConfirmSheet` a11y uplift is out of scope for this feature and will be tracked separately.

## UX + Product Flow
- [x] Add a top-right `Select` action in `RecipesClient` that toggles selection mode.
- [x] In selection mode, each recipe card shows a checkbox; tapping card toggles selection instead of navigating.
- [x] Add `Select all visible` and `Clear` controls for loaded items.
- [x] Show a sticky bottom action bar with `Delete (N)` and `Cancel`.
- [x] Confirmation copy: `Delete N recipes? This will archive them and hide them from your recipe list.`
- [x] After successful delete: remove archived items in UI, exit selection mode, then `router.refresh()`.

## API Design
- [x] Create `POST /api/recipes/bulk-delete` route handler (`src/app/api/recipes/bulk-delete/route.ts`).
- [x] Request schema (Zod): `{ recipe_ids: string[] }` with UUID validation, dedupe, min 1, and high safe max sized for loaded-list usage.
- [x] Auth guard via `createClient()` + `supabase.auth.getUser()`; return `401` when unauthenticated.
- [x] Scoped update query: `update({ archived: true }).eq('user_id', user.id).in('id', recipe_ids).eq('archived', false)`.
- [x] Return `{ success: true, archived_ids, archived_count, requested_count }`.
- [x] Error handling parity with existing routes (`NextResponse.json({ error }, { status })`).

## Existing Single Delete Hardening
- [x] Update `DELETE /api/recipes/[id]` to scope mutation by `.eq('user_id', user.id).eq('archived', false)`.
- [x] Keep endpoint contract unchanged for existing clients.

## Client Implementation
- [x] Extend `RecipesClient` state:
- [x] `selectionMode: boolean`
- [x] `selectedIds: Set<string>`
- [x] `bulkDeleting: boolean`
- [x] `actionError: string | null`
- [x] Add handlers:
- [x] `toggleSelectionMode()` resets selection when leaving mode.
- [x] `toggleRecipeSelected(id)` for checkbox/card toggle.
- [x] `selectVisible()` and `clearSelection()` helpers.
- [ ] `handleSearchChange` and `handleMethodChange` must clear selection and exit selection mode.
- [x] Disable `Load more` control while in selection mode.
- [x] `confirmBulkDelete()` sends `POST /api/recipes/bulk-delete` and uses `expectOk` + `runClientMutation`.
- [x] On success: remove only returned `archived_ids`, clear selection state, then `router.refresh()`.

## Component Strategy (Avoid Boolean Prop Proliferation)
- [x] Keep `RecipeListCard` as navigation-only view card.
- [x] Add a composed selection variant (e.g., `SelectableRecipeListCard`) for checkbox + toggle behavior.
- [x] Extract shared presentational recipe-card content if needed to avoid duplication without adding boolean behavior props.

## Accessibility + Interaction
- [x] Checkbox controls must be keyboard operable with visible focus.
- [x] Add ARIA labels (`Select recipe <bean name>`).
- [x] Destructive action button disabled when no items are selected or mutation is in-flight.
- [x] Track separate follow-up task for `ConfirmSheet` dialog semantics/focus/escape behavior.

## Testing Plan
- [x] Add API tests for `POST /api/recipes/bulk-delete`:
- [x] Unauthorized returns 401.
- [x] Invalid payload returns 400.
- [x] Archives only current user recipes.
- [x] Returns `archived_ids`/counts correctly for mixed IDs and already-archived IDs.
- [x] Handles large visible selections within the configured high cap.
- [x] Add API test updates for hardened `DELETE /api/recipes/[id]` scoping.
- [x] Add client tests for selection flow:
- [x] Enter/exit selection mode.
- [x] Select multiple items and verify delete count.
- [x] `Select all visible` and `Clear` behavior.
- [ ] Search/filter change clears selection + exits selection mode.
- [x] `Load more` disabled during selection mode.
- [x] Delete action removes returned `archived_ids` and triggers refresh flow.
- [x] Navigation suppression on selectable cards.

## Rollout + Guardrails
- [x] No DB migration required (existing `archived` column supports feature).
- [x] Bump `package.json` version as `MINOR` when implementing (new user-facing feature + API route).
- [x] Add user-facing entry to `CHANGELOG.md` when implementing.

## Execution Sequence
- [x] Implement bulk-delete API route + tests.
- [x] Harden single-delete route + tests.
- [x] Implement selection-mode UI components + state management.
- [x] Wire confirmation + mutation + local reconciliation + refresh.
- [x] Add/adjust interaction/regression tests.
- [ ] Run focused test suite and manual QA on mobile + desktop breakpoints.
