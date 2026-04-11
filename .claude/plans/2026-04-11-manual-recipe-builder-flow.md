# Manual Recipe Builder Flow

## Summary
- [x] Convert `/manual` from an AI recipe generation entrypoint into the first step of a manual recipe creation flow.
- [x] Keep the three-step progression: bean details -> method selection -> recipe editor.
- [x] Preserve bean-based method recommendations and still allow selecting any non-recommended method.
- [x] Remove OpenRouter recipe generation from the manual path only; keep scan/AI flows unchanged.
- [x] Bump `package.json` from `1.5.10` to `1.6.0` during implementation because this is a new user-facing feature.

## Flow Changes
- [x] Keep `src/app/manual/page.tsx` as the bean-details step and continue capturing `confirmedBean`, `targetVolumeMl`, and method recommendations in session storage.
- [x] Change the primary CTA copy on `/manual` from recommendation/generation language to navigation language such as `Continue to Methods`.
- [x] Clear stale session state for prior manual drafts or generated recipes when a new manual flow begins.
- [x] Keep `src/app/methods/page.tsx` showing the current recommended methods first, with all other methods available under the secondary list.
- [x] Remove the `/api/generate-recipe` fetch from `/methods` when the user continues from the manual flow.
- [x] Persist the chosen method in session state and route directly from `/methods` to `/recipe`.
- [x] Preserve method reselection behavior when the user navigates back from `/recipe` to `/methods`.

## Manual Draft Model
- [x] Introduce a new session-only draft type for manual recipe creation instead of trying to store incomplete data in `RecipeSchema`.
- [x] Include in the draft:
- [x] selected `method`
- [x] bean info
- [x] `display_name`
- [x] editable parameters: `coffee_g`, `water_g`, `temperature_c`, `total_time`, `grind_preferred_value`
- [x] editable draft steps with one initial blank row
- [x] any lightweight UI-only derived values needed by the editor
- [x] Extend `src/lib/recipe-session-storage.ts` with helpers to read, write, and clear the manual draft plus a flow/mode flag so `/recipe` can distinguish manual-builder mode from generated-recipe mode.

## Recipe Editor Changes
- [x] Make `src/app/recipe/RecipeSessionClient.tsx` mode-aware:
- [x] preserve the current generated-recipe behavior for scan/OpenRouter flows
- [x] add a manual-builder mode that opens directly in edit state
- [x] Reuse the saved-recipe editing patterns already implemented in `src/app/recipes/[id]`:
- [x] editable parameters UI
- [x] step add/delete/reorder/update behavior
- [x] existing draft step validation rules
- [x] Initialize manual-builder mode with:
- [x] selected method visible
- [x] bean details summary visible
- [x] blank editable parameter fields
- [x] exactly one empty step row
- [x] Hide or skip AI-only UI in manual-builder mode:
- [x] feedback/auto-adjust controls
- [x] quick adjustments
- [x] range-logic explanation panels
- [x] any OpenRouter-derived objective/rationale sections
- [x] Keep save disabled, or block save with validation feedback, until the manual draft can be converted into a valid persisted recipe payload.
- [x] Reuse the existing unauthenticated save redirect flow so a guest trying to save a manual recipe is sent through auth and returns cleanly.

## Conversion and Persistence
- [x] Keep the database schema and `/api/recipes` contract unchanged.
- [x] Add a conversion helper from the manual draft into a valid `RecipeWithAdjustment`/`SaveRecipeRequest` payload.
- [x] Fill required persisted fields that manual users are not editing directly with deterministic defaults:
- [x] `display_name` derived from method plus bean naming when available
- [x] `ratio` computed from `coffee_g` and `water_g`
- [x] full grinder bundle derived from the preferred grinder input using existing grinder helpers
- [x] `quick_adjustments` populated with neutral manual placeholders
- [x] `range_logic` populated with explicit manual placeholders such as `Manual recipe` / `Not AI-generated`
- [x] `adjustment_applied` omitted
- [x] `feedback_history` initialized empty
- [x] Validate the converted recipe before POST so the saved payload still satisfies the current Zod schemas and step consistency rules.

## Tests
- [ ] Add or update tests for `/manual` to verify bean entry still stores session state and routes to `/methods`.
- [ ] Add or update tests for `/methods` to verify manual flow selection no longer calls `/api/generate-recipe`.
- [ ] Add or update tests for `/methods` to verify recommended methods remain primary while non-recommended methods remain selectable.
- [ ] Add or update tests for `/recipe` manual mode to verify the editor starts with blank parameters and one empty step.
- [ ] Add or update tests for `/recipe` manual mode to verify AI-only feedback/adjustment sections are hidden.
- [ ] Add or update tests for manual mode step editing to cover add, delete, reorder, and validation behavior.
- [x] Add or update tests for conversion helpers to verify ratio math, grinder derivation, placeholder metadata, and `SaveRecipeRequestSchema` compatibility.
- [ ] Add or update tests for unauthenticated manual save to verify the existing pending-save auth flow still works.

## Assumptions
- [x] Manual flow keeps local bean-based recommendations and also exposes non-recommended methods.
- [x] The final manual builder exposes parameters plus steps, not steps-only.
- [x] Incomplete manual drafts stay session-only and are not persisted until valid.
- [x] `/api/generate-recipe` remains available for scan and other AI-driven flows.
