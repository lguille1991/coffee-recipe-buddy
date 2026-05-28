# Fellow Opus First-Class Grinder Plan

## Success should look like

- Users can choose `Fellow Opus` as their preferred grinder in Settings and save that preference successfully.
- Recipe details, recipe editing, active recipe/session, and shared recipe views all show `Fellow Opus` grind recommendations alongside the other supported grinders.
- When `Fellow Opus` is the preferred grinder, users can view and edit grind settings in plain `0.25`-increment decimal notation.
- Existing saved recipes and restored in-session recipes automatically gain valid derived `fellow_opus` settings without regeneration.
- The recipe schema, validation rules, migrations, tests, and documentation consistently treat the app as supporting five grinders while keeping `k_ultra` as the canonical source and default preference.

## Baseline metadata

- Pre-existing dirty files:
  - `docs/grinder-tables/fellow-opus-grind-table.md`
  - `.claude/plans/fellow-opus-grind-table-plan-2026-05-27.md`
- Task-owned files:
  - `.claude/plans/fellow-opus-first-class-grinder-plan-2026-05-27.md`
  - `CHANGELOG.md`
  - `package.json`
  - `src/types/recipe.ts`
  - `src/app/settings/page.tsx`
  - `src/lib/grinder-converter.ts`
  - `src/lib/grind-settings.ts`
  - `src/lib/manual-recipe.ts`
  - `src/lib/recipe-migrations.ts`
  - `src/lib/recipe-session-storage.ts`
  - `src/lib/recipe-validator.ts`
  - `src/lib/prompt-builder.ts`
  - `docs/output-format.md`
  - `docs/migration_013_add_fellow_opus.sql`
  - `src/app/recipes/[id]/_components/RecipeDetailSections.tsx`
  - `src/app/recipes/[id]/_components/RecipeEditForm.tsx`
  - `src/app/recipe/_components/RecipeSessionSections.tsx`
  - `src/app/recipe/_hooks/useFeedbackFlow.ts`
  - `src/app/recipe/_hooks/useManualRecipe.ts`
  - `src/app/share/[token]/page.tsx`
  - `src/app/share/[token]/ShareRecipeClient.tsx`
  - `src/app/api/share/[token]/clone/route.ts`
  - `src/app/api/share/[token]/clone/route.test.ts`
  - `src/app/api/recipes/[id]/auto-adjust/route.ts`
  - `src/app/api/recipes/[id]/auto-adjust/route.test.ts`
  - `src/lib/__tests__/grinder-converter.test.ts`
  - `src/lib/__tests__/manual-recipe.test.ts`
  - `src/lib/__tests__/recipe-migrations.test.ts`
  - `src/lib/__tests__/prompt-builder.test.ts`
  - `src/lib/__tests__/recipe-session-storage.test.ts`
  - `src/lib/__tests__/recipe-validator.test.ts`
- Review-scope note:
  - If implementation reveals additional touched files, append them to this task-owned list before review so Step 3 can scope `review-recent-changes` deterministically.
- Release hygiene note:
  - This is an app/runtime behavior change, so `package.json` requires a SemVer bump.
  - `CHANGELOG.md` should be updated with the new grinder support.

## Resolved decisions

- `fellow_opus` is a first-class grinder in the recipe schema and profile preference model.
- `fellow_opus` is derived from canonical `k_ultra` values, not independently generated.
- Opus values use plain decimal settings in `0.25` increments everywhere for edit, display, and persistence.
- Existing saved recipes and session-carried recipes should auto-migrate to include derived `fellow_opus`.
- Existing shared recipe snapshots should be upgraded at read/clone boundaries so old public share links remain compatible.
- The official recipe contract changes from “all 4 grinders” to “all 5 grinders”.
- Default preferred grinder remains `k_ultra`; `fellow_opus` is opt-in.
- The Opus conversion table must be treated as a locked dependency: if the dirty grinder-table doc needs edits during implementation, add it to task-owned files as part of a plan refresh before relying on the changed mapping.

## Implementation checklist

- [x] Expand the grinder domain model to include `fellow_opus`.
  - Update `GrinderIdSchema`, `GRINDER_DISPLAY_NAMES`, recipe `grind` object typing, and any grinder arrays/enums currently hard-coded to four items.
  - Audit settings, recipe detail, recipe session, share, manual recipe, and edit code paths for fixed four-grinder assumptions.

- [x] Add profile persistence support for `fellow_opus`.
  - Create a new SQL migration doc `docs/migration_013_add_fellow_opus.sql` to extend the `profiles.preferred_grinder` check constraint with `fellow_opus`.
  - Update profile-facing validation and tests so API/profile reads and writes accept the new grinder while keeping `k_ultra` as the default.

- [x] Add deterministic Fellow Opus conversion and formatting helpers in `src/lib/grinder-converter.ts`.
  - Build Opus micron mapping using `docs/grinder-tables/fellow-opus-grind-table.md` as the reference source.
  - Implement both directions:
    - K-Ultra clicks -> Opus quarter-step decimal
    - Opus decimal -> K-Ultra clicks
  - Add Opus-aware helpers for:
    - `parseGrinderValueForEdit`
    - `grinderValueToKUltraClicks`
    - `kUltraClicksToGrinderValue`
    - `parseGrinderRange`
    - `formatGrinderSettingForDisplay`
    - `formatGrinderRangeForEdit`
  - Add Opus-specific validation so only quarter-step values are accepted for edit/manual-entry flows.

- [x] Extend derived grind-setting generation to emit `fellow_opus`.
  - Update `src/lib/grind-settings.ts` so every derivation path that currently emits `q_air`, `baratza_encore_esp`, and `timemore_c2` also emits `fellow_opus`.
  - Preserve `k_ultra` as the canonical source of truth for derived recalculation during editing, auto-adjustment, freshness recalculation, and skill grind application.

- [x] Update recipe creation and editing flows to understand Opus as a decimal grinder.
  - Manual recipe creation:
    - accept Opus quarter-step decimal input
    - derive Opus alongside the other grinders
  - Saved recipe editing:
    - allow Opus numeric-decimal entry with `step=0.25`
    - validate quarter-step increments
    - recompute derived grind settings correctly when the preferred grinder is Opus
  - Ensure range messaging and edit affordances show Opus values without “clicks” notation.

- [x] Add automatic recipe migration for `fellow_opus`.
  - Bump the recipe schema version.
  - Add a migration step that derives `fellow_opus` from `k_ultra` for older persisted recipes.
  - Ensure migration coverage applies to:
    - saved recipe detail loads
    - historical snapshots
    - shared recipe snapshots loaded by `src/app/share/[token]/page.tsx` and `src/app/share/[token]/ShareRecipeClient.tsx`
    - shared recipe clone payloads validated in `src/app/api/share/[token]/clone/route.ts`
    - session/local storage recovery where migrated recipe JSON is rehydrated
  - Centralize session/local-storage migration in `src/lib/recipe-session-storage.ts` so consumers such as `useFeedbackFlow` and `useManualRecipe` read already-migrated recipe payloads instead of duplicating migration logic.

- [x] Update UI surfaces that render grinder choices or secondary grinder recommendations.
  - Settings screen: add `Fellow Opus` to preferred grinder selection.
  - Recipe details screen: include `fellow_opus` in the primary/secondary grinder rendering logic.
  - Recipe edit screen: include Opus in primary and “See more grinders” displays.
  - Active recipe/session screen: include Opus alongside other recommended grinders.
  - Shared recipe view: show Opus in the public secondary grinder list.
  - Confirm legacy shared snapshots render correctly after read-time migration and that clone-from-share succeeds for pre-Opus payloads.

- [x] Update generation/validation documentation and contracts to five grinders.
  - Update `src/lib/prompt-builder.ts` and `docs/output-format.md` so the documented contract is “all 5 grinders”.
  - Keep the implementation deterministic by continuing to derive Opus from K-Ultra after canonical grind output is established.
  - Update validator error text and non-empty checks from four grinders to five grinders.

- [ ] Add or update focused tests for the new grinder.
  - Conversion tests:
    - Opus round-trip behavior vs K-Ultra
    - Opus display/edit formatting
    - Opus range formatting and parsing
    - quarter-step validation behavior
  - Migration tests:
    - old recipes gain `fellow_opus`
    - full-chain migration ends with all five grinders present
    - legacy shared snapshot payloads render and clone successfully after migration
    - session-storage restore returns migrated recipes with `fellow_opus`
  - Recipe validator tests:
    - valid recipes require all five grinders
  - Saved recipe/manual recipe/edit-flow tests:
    - Opus preferred grinder draft creation
    - Opus live recalculation
    - Opus invalid-entry handling
  - Profile/settings tests:
    - `preferred_grinder: 'fellow_opus'` is accepted and rendered

- [x] Apply release hygiene.
  - Bump `package.json` version with an appropriate SemVer increment.
  - Add a concise user-facing `CHANGELOG.md` entry describing Fellow Opus support across preferences and recipe screens.

- [ ] Review and validate after implementation.
  - Run the required review pass on the task-owned diff.
  - If review finds issues, report findings and wait for approval before fixes.
  - For each approved fix batch, refresh the task-owned file list and newly observed ambient dirty files if scope changed, then rerun the review pass.
  - After review approval, run commit-readiness validation:
    - `npm test`
    - `npm run lint`
    - `npm run build`
  - If validation fails, report failures, request approval for fixes, apply the approved fix batch, then return to review before asking for commit-readiness again.
  - If validation passes, provide at least one suggested commit message.

## Risks to watch during implementation

- Fixed-length grinder assumptions appear in schema, validators, UI arrays, tests, and prompt docs; partial updates will create runtime and test drift.
- Opus is the first quarter-step decimal grinder, so integer-only edit helpers and “clicks” display formatting need careful separation from Baratza/Timemore behavior.
- Migration scope must cover both persisted recipes and any recipe JSON restored from session/local storage to avoid broken detail/edit experiences for older recipes.
- Legacy shared snapshots are immutable historical payloads, so compatibility depends on explicit read-time migration or clone-time upgrade rather than only schema updates for newly saved recipes.
