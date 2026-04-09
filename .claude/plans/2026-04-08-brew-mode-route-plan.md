# Brew Mode Route Refactor Plan

## Summary
- [ ] Split "saved recipe detail" and "active brew mode" into separate routes.
- [ ] Keep `/recipe` as the generated recipe review/save screen only.
- [ ] Make `/recipes/[id]/brew` the only place where timer controls, active-step focus, and brew-step highlight animation exist.
- [ ] Guard all attempts to exit brew mode after the timer has started with a confirmation sheet that warns the timer will stop and reset.

## Routing And Data Flow
- [ ] Keep `src/app/recipes/[id]/page.tsx` as the saved recipe detail route and remove brew-mode behavior from that screen.
- [ ] Add `src/app/recipes/[id]/brew/page.tsx` as a dedicated authenticated server route that loads the saved recipe by `id` from Supabase using `createClient()` and `await params`.
- [ ] Add `src/app/recipes/[id]/brew/loading.tsx` so the dynamic brew route partially prefetches and feels immediate during client-side navigation.
- [ ] Pass the loaded `SavedRecipe` into a new dedicated brew-mode client component instead of relying on `recipeSessionStorage`.
- [ ] Update the existing `Brew` CTA on the saved recipe detail screen to navigate to `/recipes/${id}/brew`.
- [ ] Do not allow direct brew mode from the generated `/recipe` screen; users must save first and enter from `/recipes/[id]`.

## UI And Behavior Changes
- [ ] Remove the start/stop timer button, elapsed timer display, active-step focus state, and step-progress highlight animation from `src/app/recipe/_components/RecipeSessionSections.tsx`.
- [ ] Keep the generated `/recipe` screen usable for reviewing adjustments and saving, but render brew steps as static content only.
- [ ] Build a focused brew-mode UI for `/recipes/[id]/brew` that shows essential recipe context plus the timer and brewing steps only.
- [ ] Reuse the existing timer logic from `src/app/recipe/_hooks/useWakeLockTimer.ts`, but wire it into the dedicated brew-mode client instead of the generated recipe review screen.
- [ ] Reuse the saved recipe’s current recipe JSON as the brew source of truth so brew mode always reflects the latest persisted edits.
- [ ] Keep edit/share/notes/delete/auto-adjust controls out of brew mode to avoid mixing active brewing with recipe management.

## Exit Validation And Navigation Guard
- [ ] Add a brew-mode exit guard that becomes active once the timer has started or elapsed time is non-zero.
- [ ] Show a confirmation sheet explaining that leaving brew mode will stop and reset the timer.
- [ ] If the user confirms, stop/reset the timer and continue the pending navigation.
- [ ] If the user cancels, remain on the brew screen with the timer state intact.
- [ ] Apply the guard to in-app navigation through `NavGuardContext`, the brew screen back button, and browser/tab exit paths where the browser allows intervention.
- [ ] Keep the warning specific to brew mode; saved recipe detail and generated `/recipe` should continue using their current unsaved-change/edit guards.

## Component And Interface Changes
- [ ] Introduce a new brew-mode client component under `src/app/recipes/[id]/brew/` for the focused brewing experience.
- [ ] Extract any shared static recipe presentation needed by both saved detail and brew mode so timer-specific UI is not duplicated across screens.
- [ ] Keep public route contracts simple:
  - [ ] `/recipes/[id]`: saved recipe detail, editing, sharing, notes, and entry point to brew mode.
  - [ ] `/recipes/[id]/brew`: active brew session for the saved recipe.
  - [ ] `/recipe`: generated unsaved recipe review/save flow only.
- [ ] Bump `package.json` patch version because this is a behavior/UI refactor, not a new public API or breaking schema change.

## Test Plan
- [ ] Add or update tests for route-level behavior so saved recipes still require auth and brew mode loads by `id`.
- [ ] Add client tests for the generated `/recipe` screen to confirm timer controls are absent there.
- [ ] Add client tests for brew mode to confirm timer controls, active-step highlighting, and progress animation are present only on `/recipes/[id]/brew`.
- [ ] Add tests for navigation-guard behavior:
  - [ ] no warning before the timer starts
  - [ ] warning after the timer has started
  - [ ] confirm exits and resets timer
  - [ ] cancel keeps the session active
- [ ] Verify the `Brew` button on `/recipes/[id]` links to `/recipes/[id]/brew`.
- [ ] Run `vitest` coverage for affected helpers/components and a `next build` sanity check after implementation.

## Assumptions
- [ ] Brew mode should be accessible only from a saved recipe, not from the generated unsaved recipe flow.
- [ ] Brew mode should fetch the saved recipe directly from the database instead of depending on `recipeSessionStorage`.
- [ ] Exit protection should cover all exits we can intercept: in-app nav, app back button, browser back, refresh, and tab close where supported.
- [ ] Brew mode should be a focused brewing surface, not a duplicate of the full saved recipe detail screen.
