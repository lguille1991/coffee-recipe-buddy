# Recipes Screen Favorites + Ownership Sections + Pagination Plan

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
- [x] `Shared Recipes` definition: recipes shared with me.
- [x] Favorite pinning scope: both `My Recipes` and `Shared Recipes`.
- [x] Deletion UX for favorites: hide delete action in the UI.
- [x] Pagination UX: numbered pages (`Prev/Next` + page index controls as needed).

## Data Model + Querying
- [ ] Verify schema support for favorites (`recipes.is_favorite` or equivalent). If missing, add DB migration + types update.
- [ ] Verify schema support for shared-with-me relation (e.g., share table or membership relation). If missing, define source-of-truth relation before UI work.
- [ ] Update recipes fetch logic to support:
- [ ] section filtering (`favorites`, `owned`, `shared_with_me`)
- [ ] stable sorting with favorites first where applicable, then recent tie-breaker
- [ ] pagination (`limit=10` with offset/cursor and total-count metadata)
- [ ] Avoid async waterfalls by loading independent section counts/metadata via `Promise.all()` where needed.

## API + Server Actions
- [ ] Add/extend endpoint or Server Action to toggle favorite state for a recipe with auth + ownership/visibility checks.
- [ ] Add/extend delete endpoint guard: reject delete when `is_favorite = true` (server-enforced, regardless of UI hiding).
- [ ] Ensure guard applies consistently to single delete and bulk delete flows.
- [ ] Return clear typed errors for blocked delete attempts (e.g., `FAVORITE_RECIPE_DELETE_BLOCKED`).

## UI Implementation (`/recipes`)
- [ ] Add tab navigation UI for `Favorites`, `My Recipes`, `Shared Recipes`.
- [ ] Add favorite star action on each recipe card/list row.
- [ ] Hide delete action for favorited recipes in all relevant card/action menus.
- [ ] Keep component architecture compositional (avoid boolean prop proliferation by using variants/composed components).
- [ ] Keep recipe list rendering capped to current page size (10).
- [ ] Add empty states per section and per page result set.

## Pagination Behavior
- [ ] Implement server-driven numbered pagination with page size constant `10`.
- [ ] Include `Prev`/`Next` controls and current-page indicator.
- [ ] Reset to page 1 when changing subsection, search term, or sort/filter controls.
- [ ] Preserve section + page in URL query params for shareable state (if current screen pattern already does this).
- [ ] Prevent out-of-range pages after data changes (favorite toggle/delete/share updates).

## Security + Authorization
- [ ] Ensure favorite toggle is authorized for the relevant recipe visibility scope.
- [ ] Ensure shared recipe queries do not leak private records.
- [ ] Ensure favorite-delete guard cannot be bypassed by direct API calls.

## Testing Plan
- [ ] Add tests for tab switching and correct dataset per subsection.
- [ ] Add tests for favorite toggle UX + persistence.
- [ ] Add tests verifying favorites sort to top in `My Recipes` and `Shared Recipes`.
- [ ] Add tests verifying delete UI is hidden for favorites.
- [ ] Add tests verifying delete is server-blocked for favorites in all delete entry points.
- [ ] Add tests for pagination boundaries (first, middle, last, empty page fallback).
- [ ] Add tests for page reset on subsection/filter changes.

## Release + Repo Requirements
- [ ] Bump `package.json` version as `MINOR` during implementation (user-facing feature additions).
- [ ] Add user-facing changelog entry to `CHANGELOG.md` during implementation.

## Execution Sequence
- [ ] Finalize/adjust schema + query contracts.
- [ ] Implement backend favorite mutation + delete guards.
- [ ] Implement tabs + recipe action updates.
- [ ] Implement numbered pagination and query-state wiring.
- [ ] Add/adjust tests, then run focused QA for desktop/mobile.
