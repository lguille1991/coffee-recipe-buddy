# Recipes Screen Favorites + Ownership Sections + Pagination Plan

## Mandatory Pre-Implementation Compliance
- [ ] Read `.agents/docs/REACT_BEST_PRACTICES.md` before any implementation work.

## Goals
- [ ] Add three subsections on `/recipes`: `Favorites`, `My Recipes`, and `Shared Recipes`.
- [ ] Render subsections as tabs (one visible at a time).
- [ ] Define `Shared Recipes` as recipes shared with the current user.
- [ ] Add a star icon action to mark/unmark a recipe as favorite.
- [ ] Favorited recipes should be pinned above non-favorited recipes in both `My Recipes` and `Shared Recipes`.
- [ ] Prevent deletion of favorited recipes through all existing recipe deletion paths and hide delete UI for those recipes.
- [ ] Add numbered pagination so only 10 recipes are rendered per page at a time.

## Locked Product Decisions
- [x] Section behavior: tabs/segment control with one section visible at a time.
- [x] `Shared Recipes` definition target: recipes shared with me.
- [x] Favorite pinning scope: both `My Recipes` and `Shared Recipes`.
- [x] Deletion UX for favorites: hide delete action in the UI.
- [x] Pagination UX: numbered pages (`Prev/Next` + page index controls as needed).
- [x] `Favorites` tab scope: combined list of owned + shared-with-me recipes.
- [x] Keep `Active/Archived` controls on `/recipes`.
- [x] `Active/Archived` applies only to `My Recipes`.
- [x] Shared-recipient actions: view + favorite + remove from my list.

## Data Model + Querying (Blockers First)
- [ ] Define source of truth for `shared_with_me` before UI work.
- [ ] Current `shared_recipes` model is public-link based; if recipient-based sharing is required, add recipient relation, RLS, indexes, and backfill/migration decision.
- [ ] Decide favorite ownership model before schema changes.
- [ ] If favorites appear in `Shared Recipes`, implement per-user favorite relation (not global recipe-row favorite), with indexes, RLS, and generated types updates.
- [ ] Add recipient-side “remove from my list” model (e.g., hidden/muted membership state) that does not modify owner recipe data.
- [ ] Update recipes fetch logic to support:
- [ ] section filtering (`favorites`, `owned`, `shared_with_me`)
- [ ] stable sorting with favorites first where applicable, then recent tie-breaker
- [ ] pagination (`limit=10` with offset/cursor and total-count metadata)
- [ ] `Active/Archived` filter only for `My Recipes`
- [ ] Avoid async waterfalls by loading independent section counts/metadata via `Promise.all()` where needed.

## API + Route Handlers (Single Mutation Path)
- [ ] Use route handlers as the only mutation path for this feature set (no parallel Server Action mutation path).
- [ ] Add/extend favorite-toggle route with auth + ownership/visibility checks.
- [ ] Add/extend shared-recipient remove-from-list route with auth + membership checks.
- [ ] Any dynamic route must await Promise-based `params` before destructuring.
- [ ] Add/extend delete guards to reject delete when recipe is favorited (server-enforced regardless of UI hiding).
- [ ] Ensure guard coverage includes:
- [ ] `DELETE /api/recipes/[id]`
- [ ] `POST /api/recipes/bulk-delete`
- [ ] recipe detail page delete action flow
- [ ] selection-mode bulk delete flow
- [ ] Return clear typed errors for blocked delete attempts (e.g., `FAVORITE_RECIPE_DELETE_BLOCKED`).

## UI Implementation (`/recipes`)
- [ ] Add tab navigation UI for `Favorites`, `My Recipes`, `Shared Recipes`.
- [ ] Add favorite star action on each recipe card/list row.
- [ ] Add “Remove from my list” action in `Shared Recipes` where applicable.
- [ ] Hide delete action for favorited recipes in all relevant card/action menus.
- [ ] Keep `Active/Archived` controls visible only in `My Recipes` tab.
- [ ] Keep component architecture compositional (avoid boolean prop proliferation by using variants/composed components).
- [ ] Keep recipe list rendering capped to current page size (10).
- [ ] Add empty states per section and per page result set.

## Pagination Contract Migration
- [ ] Implement server-driven numbered pagination with page size constant `10`.
- [ ] Include `Prev`/`Next` controls and current-page indicator.
- [ ] Replace current cumulative `Load more` contract so page `N` renders only page `N` results.
- [ ] Remove/replace client append semantics and `hasMore` behavior tied to cumulative loading.
- [ ] Reset to page 1 when changing subsection, search term, or sort/filter controls.
- [ ] Preserve section + page in URL query params for shareable state (if current screen pattern already does this).
- [ ] Prevent out-of-range pages after data changes (favorite toggle/delete/share updates).

## Security + Authorization
- [ ] Ensure favorite toggle is authorized for the relevant recipe visibility scope.
- [ ] Ensure shared recipe queries do not leak private records.
- [ ] Ensure shared-recipient remove-from-list action is scoped to current user membership.
- [ ] Ensure favorite-delete guard cannot be bypassed by direct API calls.

## Testing Plan
- [ ] Add tests for tab switching and correct dataset per subsection.
- [ ] Add tests for favorite toggle UX + persistence.
- [ ] Add tests verifying favorites sort to top in `My Recipes` and `Shared Recipes`.
- [ ] Add tests verifying delete UI is hidden for favorites.
- [ ] Add tests verifying delete is server-blocked for favorites in all delete entry points.
- [ ] Add tests for shared-recipient remove-from-list behavior and visibility.
- [ ] Add regression tests for existing archived/restore flows in `My Recipes` after tabs are introduced.
- [ ] Add tests for pagination boundaries (first, middle, last, empty page fallback).
- [ ] Add tests for page reset on subsection/filter changes.
- [ ] Add tests verifying migration away from cumulative loading/append behavior.

## Release + Repo Requirements
- [ ] Bump `package.json` version as `MINOR` during implementation (user-facing feature additions).
- [ ] Add user-facing changelog entry to `CHANGELOG.md` during implementation.

## Execution Sequence
- [ ] Finalize schema changes for recipient sharing + per-user favorites + recipient remove-from-list state.
- [ ] Implement/extend route handlers with auth + favorite delete guards.
- [ ] Implement tabs + recipe actions + My Recipes-only archive controls.
- [ ] Implement numbered pagination and remove cumulative loading behavior.
- [ ] Add/adjust tests, then run focused QA for desktop/mobile.
