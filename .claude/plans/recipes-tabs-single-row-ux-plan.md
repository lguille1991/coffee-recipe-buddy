# Recipes Tabs UX Redesign (Single Row Header Controls)

## Scope
- [ ] Replace the current two-row section/status control on `/recipes` with a single header controls block.
- [ ] Keep existing query params as the source of truth for data loading: `section` and `archived`.
- [ ] Treat this as a UI refactor only; no API or schema changes.

## Product Decisions
- [ ] Keep section order explicitly as: `Favorites`, `My Recipes`, `Shared Recipes`.
- [ ] Keep section labels unchanged across breakpoints for this pass; do not introduce conditional `My`/`My Recipes` copy switching.
- [ ] Keep `archived` applicable only to section `my`.
- [ ] When leaving `my`, remove `archived=true` from the URL and return to default active state when the user comes back to `my`.
- [ ] Preserve current navigation semantics with `router.replace`; do not add browser-history entries for tab/status changes in this pass.
- [ ] Use segmented button groups for both section and status controls; do not implement ARIA `switch`.

## Layout
- [ ] Keep the page title row separate from controls if needed for stability.
- [ ] Render section tabs and the `my`-only status control inside one shared controls container so there is no second standalone tab row.
- [ ] Desktop: place section tabs first and the status segmented control at the right edge of the same controls container when `section === 'my'`.
- [ ] Mobile: allow the shared controls container to wrap, but keep both controls within the same visual block.
- [ ] Keep the `Select` action in the title row where it exists today; do not merge it into the tabs/status container.

## Behavior
- [ ] Preserve existing URL rules:
- [ ] `section=my` is represented by omitting `section`.
- [ ] `archived=true` is present only for archived `my` view.
- [ ] Section changes continue to reset `page` to `1`.
- [ ] Status changes continue to reset `page` to `1`.
- [ ] Preserve existing search and method params when switching section/status.
- [ ] Preserve current behavior that selection mode and selected IDs reset when section/status/method/search changes.
- [ ] Hide the status control entirely outside `my`.
- [ ] Hide the `Select` button outside `my`, as today.

## Accessibility
- [ ] Give the section control an explicit accessible grouping label.
- [ ] Give the status control an explicit accessible grouping label such as `Recipe status`.
- [ ] Expose selected state with the chosen segmented-control semantics consistently.
- [ ] Ensure all controls remain keyboard reachable with visible focus styles.

## Implementation Notes
- [ ] Refactor the header/control layout in `src/app/recipes/RecipesClient.tsx` without changing data-fetching ownership in `src/app/recipes/page.tsx`.
- [ ] Avoid introducing new client persistence for archived status in this pass.
- [ ] Keep current query update behavior centralized in `updateUrl`.

## Test Plan
- [ ] Add component tests for section switching updating `section` exactly as current behavior requires.
- [ ] Add component tests for archived toggle adding/removing `archived=true` only in `my`.
- [ ] Add component tests that switching away from `my` clears archived state and hides the status control.
- [ ] Add component tests that method/search params are preserved while section/status changes reset `page` to `1`.
- [ ] Add component tests that selection mode resets on section/status changes.
- [ ] Add SSR/page tests for deep links:
- [ ] `/recipes?section=favorites`
- [ ] `/recipes?section=shared`
- [ ] `/recipes?archived=true`
- [ ] Add accessibility-focused tests for selected-state attributes and accessible labels.
- [ ] Verify manually at narrow mobile widths that the controls container wraps without overflow and without creating a second visual tab row.
