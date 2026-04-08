# Preferred Grinder Generation Refactor

## Summary

- [ ] Keep **K-Ultra as the canonical internal reference** for validation, range logic, persistence, adjustments, and migrations.
- [ ] Add **`preferred_grinder` as an explicit generation input** so the LLM can reason in the user’s primary grinder scale instead of only in K-Ultra.
- [ ] Treat the LLM’s grind output for the preferred grinder as **advisory input**, then deterministically normalize it back to K-Ultra and regenerate all grinder outputs from that canonical value.
- [ ] Avoid grinder-specific divergence in downstream flows: edits, feedback adjustment, freshness recalculation, migrations, and auto-adjust must continue to operate from canonical K-Ultra values.

## Implementation Changes

- [ ] Extend the recipe-generation request contract to accept `preferred_grinder` alongside `method`, `bean`, and `targetVolumeMl`.
- [ ] In the client generation flow, read the profile preference from the existing profile hook on the method-selection screen and include it in the `POST /api/generate-recipe` payload.
- [ ] Update the prompt builder to accept `preferred_grinder` and inject a short, explicit instruction block:
  - [ ] Tell the model which grinder is the user’s primary grinder.
  - [ ] Ask it to optimize the recommendation for that grinder’s native notation and stepping behavior.
  - [ ] Still require all grinder fields in the JSON output.
  - [ ] Still require `range_logic` and `final_operating_range` in K-Ultra clicks so validation rules remain unchanged.
- [ ] After LLM validation succeeds, choose the canonical starting point using this precedence:
  - [ ] If `preferred_grinder === 'k_ultra'`, keep the existing K-Ultra output as canonical.
  - [ ] Otherwise parse `recipe.grind[preferred_grinder].starting_point` with the existing grinder conversion helpers and convert it to canonical K-Ultra clicks.
  - [ ] Clamp or fall back to the midpoint of the validated K-Ultra operating range if the preferred-grinder value is missing or unparsable.
- [ ] Rebuild `recipe.grind` deterministically from the canonical K-Ultra low/high/start values:
  - [ ] Keep `k_ultra` canonical and fully normalized.
  - [ ] Recompute `q_air`, `baratza_encore_esp`, and `timemore_c2` using the existing converter functions.
  - [ ] Overwrite any LLM drift in non-canonical grinder values so persisted recipes stay coherent.
- [ ] Preserve the current architectural boundary:
  - [ ] LLM decides recipe intent and preferred-grinder target.
  - [ ] App decides canonical click value and all cross-grinder conversions.
- [ ] Add one narrow helper in the generation route or converter layer for “derive canonical K-Ultra starting clicks from preferred grinder output” instead of scattering this logic across UI and API code.

## Public Interfaces / Types

- [ ] Update the request schema for `POST /api/generate-recipe` to include optional `preferred_grinder: GrinderId`.
- [ ] Update the prompt-builder function signature to accept `preferred_grinder?: GrinderId`.
- [ ] Do **not** change persisted recipe shape or `range_logic` schema in this refactor.
- [ ] Do **not** change adjustment endpoints or saved recipe migration behavior; they should continue to consume canonical K-Ultra-centered recipe data.

## Test Plan

- [ ] Add request-level tests for recipe generation input parsing with and without `preferred_grinder`.
- [ ] Add prompt-builder tests asserting the preferred grinder instruction appears only when provided.
- [ ] Add generation-route tests for canonicalization precedence:
  - [ ] `preferred_grinder = k_ultra` uses K-Ultra starting point directly.
  - [ ] `preferred_grinder = q_air` converts Q-Air R.C.M to K-Ultra and regenerates all grinders.
  - [ ] `preferred_grinder = baratza_encore_esp` converts Baratza clicks to K-Ultra and regenerates all grinders.
  - [ ] `preferred_grinder = timemore_c2` converts Timemore clicks to K-Ultra and regenerates all grinders.
  - [ ] Invalid preferred-grinder starting point falls back to validated K-Ultra midpoint.
- [ ] Add an integration test proving the persisted recipe remains internally consistent:
  - [ ] `range_logic.final_operating_range` stays in K-Ultra clicks.
  - [ ] `grind.k_ultra.starting_point` matches the canonicalized value.
  - [ ] Every non-K-Ultra grinder matches deterministic converter output from that canonical value.
- [ ] Keep existing grinder-converter round-trip tests; add any missing coverage for parsing preferred-grinder starting-point strings used in generation.

## Assumptions And Defaults

- [ ] Default to `k_ultra` when the user is unauthenticated, profile load fails, or `preferred_grinder` is absent.
- [ ] Canonical K-Ultra remains the single source of truth for all downstream math because the current validator, range system, and adjustment engine are already built around it.
- [ ] This refactor improves practical accuracy by letting the model choose a starting point in the user’s grinder’s native scale, without forcing a larger rewrite of validation, storage, and adjustment logic.
- [ ] This refactor does **not** make each grinder fully native end-to-end; it is the cleanest incremental design before a larger grinder-native architecture change.
