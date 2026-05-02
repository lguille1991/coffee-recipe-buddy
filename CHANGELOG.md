# Changelog

All notable product-facing changes are documented here.

## [1.18.4] - 2026-05-02

- Changed saved-coffee profile generation flow in Methods so `/api/recipes/from-profile` results now navigate directly to `/recipes/:id` using returned `recipeId` instead of entering the unsaved `/recipe` session flow.
- This prevents creating an unintended second recipe record when users press Save after profile-based generation, since the profile path already persists a recipe row server-side.

## [1.18.3] - 2026-05-02

- Added idempotent recipe-create dedupe for both `POST /api/recipes/from-profile` and `POST /api/recipes` so concurrent identical requests return the same existing recipe result (`201` for first create, `200` for replay) instead of creating duplicate recipe rows.
- Added a shared request-idempotency helper with stable payload keying and short replay TTL for duplicate suppression during rapid retries/double-submits.
- Added regression coverage for concurrent duplicate create attempts on profile-based and manual recipe save paths, asserting single persistence call and shared recipe identity.

## [1.18.2] - 2026-05-02

- Added parity debug metadata (`_debug.grind_parity_mode`, `_debug.strict_grinder_table_parity`) to `POST /api/recipes/from-profile` responses behind `DEBUG_RECIPE_PARITY=1` so coffee-profile generation paths can be validated locally with the same visibility as direct recipe generation.
- Wired profile-based recipe generation to pass `SKILL_GRIND_PARITY_MODE` through to deterministic grind calculation.
- Added route test coverage for profile-path debug parity metadata.

## [1.18.1] - 2026-05-02

- Added optional recipe-generation debug metadata (`_debug.grind_parity_mode`, `_debug.strict_grinder_table_parity`) behind `DEBUG_RECIPE_PARITY=1` to make local parity-mode verification explicit before production rollout.
- Added API route test coverage for debug parity metadata response behavior.

## [1.18.0] - 2026-05-02

- Added `SKILL_GRIND_PARITY_MODE=skill_v2` deterministic grind mode to replicate tighter skill-style method base ranges (for V60, Chemex, AeroPress, and other supported methods) while keeping legacy behavior as default rollout-safe fallback.
- Added skill_v2 density alignment logic (altitude + variety) to avoid over-stacking opposing micro-adjustments and better match skill parity behavior.
- Added washed/floral guardrail behavior in skill_v2 mode to prevent over-coarsening for high-altitude light-profile coffees by capping freshness coarsening and biasing finer grind selection.
- Removed legacy deterministic origin-token click offsets from the grind engine so parity logic is driven by process, roast, freshness, and density factors.
- Expanded deterministic grind tests with new skill_v2 parity coverage and updated legacy expectations after removing origin-token offsets.

## [1.17.0] - 2026-05-01

- Added active-profile duplicate prevention for coffee profile creation using normalized fingerprint matching across label, roaster, bean name, origin, process, and roast level.
- Added typed duplicate-block API responses (`status: duplicate_blocked`) with candidate profile metadata and default selected existing profile id.
- Added database migration `docs/migration_010_coffee_profile_duplicate_fingerprint.sql` to backfill and enforce per-user active-profile uniqueness via `duplicate_fingerprint`.
- Added analysis flow handling for duplicate profile conflicts with default `Use Existing` action and cancel behavior for both save-only and save+generate paths.
- Added methods flow branching to generate from an existing selected coffee profile via `/api/recipes/from-profile`, preserving profile linkage and `last_used_at` updates.
- Added tests for duplicate fingerprint normalization/sorting and API duplicate-block responses.

## [1.16.6] - 2026-05-01

- Added an analysis-screen leave confirmation prompt that warns users unsaved coffee profile data will be lost when navigating away before saving.

## [1.16.5] - 2026-05-01

- Fixed post-save analysis CTAs (`View Saved Coffee` and `Generate Recipe Now`) to split the full available row width evenly so their combined width matches the `Save + Generate Recipe` CTA.

## [1.16.4] - 2026-05-01

- Fixed scan extraction variety normalization to recognize `Pacas` from extracted text so `bean.variety` is populated even when the model only returns `bean_name`.

## [1.16.3] - 2026-05-01

- Added recipe-detail navigation from saved recipe bean name to linked saved coffee profile (`/coffees/[id]`) when a `coffee_profile_id` exists.
- Extended saved recipe detail selection/types to include `coffee_profile_id` so recipe UI can resolve coffee-profile navigation.
- Added archive protection for coffee profiles linked to active recipes: `POST /api/coffee-profiles/:id/archive` now returns `409` instead of archiving.
- Added archive route tests covering both blocked (linked active recipes) and successful archive flows.

## [1.16.2] - 2026-05-01

- Added split analysis actions so users can either `Save Coffee` only or `Save + Generate Recipe` from scan confirmation.
- Added in-place save-only success UX on analysis with CTAs to view the saved coffee or generate immediately.
- Added save-only session cleanup so recipe-generation state is not unintentionally persisted when only saving a profile.
- Added typed profile image upload status in `POST /api/coffee-profiles` (`uploaded | failed | none`) for explicit client handling.
- Added coverage for profile-create response semantics and saved-coffee nav feature-flag visibility behavior.
- Added documentation for save-only flow and later-generation semantics in `docs/save-only-coffee-profile-flow.md`.

## [1.16.1] - 2026-05-01

- Added environment-gated rollout control for Saved Coffee Profiles via `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES` across APIs, pages, and navigation visibility.
- Added validation route coverage for profile-based generation payload errors (non-canonical method and invalid water-mode combinations).
- Added feature-flag-off route coverage to verify saved-profile APIs and profile-based generation return `404` when disabled.
- Added staging rollout checklist at `docs/saved-coffee-profiles-staging-rollout.md` with preconditions, smoke checks, ownership checks, and go/no-go criteria.

## [1.16.0] - 2026-05-01

- Added scan-to-profile persistence in the analysis confirmation flow so confirmed bean edits are saved as reusable coffee profiles before recipe generation continues.
- Added authenticated multipart image upload endpoint for saved coffee profiles (`POST /api/coffee-profiles/:id/image`) with server-side optimization and primary-image replacement handling.
- Added first-pass Saved Coffees UI: list page, detail page, generate-from-profile form, and archive action.
- Added top-level Coffees navigation entry for mobile and desktop nav.
- Added route tests covering coffee profile auth guards and profile-based recipe generation behaviors (unauthorized, archived blocked, profile not found, and provenance payload expectations).

## [1.15.0] - 2026-05-01

- Added backend support for saved coffee profiles with per-user ownership, archive state, and linked primary coffee bag image metadata.
- Added new profile APIs: `GET/POST /api/coffee-profiles`, `GET/PATCH/DELETE /api/coffee-profiles/:id`, and `POST /api/coffee-profiles/:id/archive`.
- Added profile-driven recipe generation endpoint `POST /api/recipes/from-profile` that generates and immediately persists recipes with snapshot history.
- Added recipe-to-profile linkage and generation provenance support (`coffee_profile_id`, owner linkage, and `generation_context`) in migration docs.
- Refactored recipe persistence into a shared save helper so manual saves and profile-driven saves use the same snapshot workflow.
- Refactored recipe generation into a shared generation helper reused by `/api/generate-recipe` and `/api/recipes/from-profile`.
- Added migration `docs/migration_009_coffee_profiles.sql` for new tables, constraints, and RLS policies.

## [1.14.3] - 2026-05-01

- Fixed brew-step water text drift after ratio/water rescaling by synchronizing gram mentions inside `steps[].action` with recalculated `water_poured_g` and `water_accumulated_g`.
- Applied this sync in both deterministic recipe generation water scaling and feedback-adjustment ratio scaling to keep displayed step text consistent across flows.
- Added regression coverage for step action gram alignment during deterministic water recomputation.

## [1.14.2] - 2026-05-01

- Fixed manual recipe construction and shared test fixtures to include required `recipe_mode` so TypeScript validation passes after recipe-mode schema updates.
- Removed dead recipe-editing imports and an unused recipe-session variable left behind after refactors.
- Deleted the unused `src/app/recipe/_hooks/index.ts` barrel and pruned unreferenced derived type exports from `src/app/recipes/[id]/_hooks/index.ts`.

## [1.14.1] - 2026-05-01

- Fixed unsaved-change navigation guard prompts so generated/manual recipe sessions and recipe edit flows correctly intercept global side/bottom nav transitions before leaving.
- Restored shared nav guard state between page-level guard setters and global navigation triggers to prevent silent route changes while drafts are unsaved.

## [1.14.0] - 2026-05-01

- Added `recipe_mode` support with deterministic `four_six` (Tetsu Kasuya 4:6) generation path including fixed 5-pour structure and canonical baseline brew parameters.
- Added strict grinder table parity mode for deterministic grind calculation (`STRICT_GRINDER_TABLE_PARITY=1`) with method-table base selection and fallback behavior for unsupported cases.
- Reduced LLM numeric responsibility by explicitly prioritizing narrative/objective/step wording in prompts while server-side deterministic engines own numeric brew parameters.
- Expanded deterministic test coverage across recipe mode behavior and strict grinder parity selection.

## [1.13.0] - 2026-05-01

- Added deterministic ratio and brew-time calculation engine and wired recipe generation to override LLM ratio/time output with local skill-based rules.
- Expanded process support in bean metadata to include `carbonic`, `thermal_shock`, and `experimental`, with deterministic grind/temperature offsets for these profiles.
- Integrated deterministic symptom-based troubleshooting into `/api/recipes/[id]/auto-adjust` so direct taste/drain complaints can be adjusted locally without requiring an LLM pass.
- Added and updated tests for deterministic brew parameters, expanded process handling, and deterministic auto-adjust routing behavior.

## [1.12.0] - 2026-05-01

- Added a deterministic temperature engine and wired recipe generation to override LLM temperature output with local skill-based rules.
- Added freshness-aware deterministic grind offsets based on roast age windows, including range-logic freshness annotations.
- Consolidated method base ranges and core offset tables into a shared skill reference module used by deterministic grind and temperature engines.
- Expanded tests for freshness windows, temperature profile behavior, and API-level deterministic override outputs.

## [1.11.2] - 2026-05-01

- Preserved process labels in deterministic `range_logic.process_offset` so downstream inference can correctly detect contexts like anaerobic processing.
- Tightened origin matching regex boundaries in deterministic grind logic to avoid accidental partial matches.
- Added API route coverage for the post-override deterministic validation failure branch (`422` response path).

## [1.11.1] - 2026-05-01

- Fixed deterministic grind offset units to use true click increments so downstream range-logic heuristics no longer misclassify process context.
- Capped deterministic K-Ultra output to the skill-compatible range ceiling to avoid generating out-of-band settings.
- Added post-override validation in recipe generation so deterministic grind mutations are validated before returning the API response.

## [1.11.0] - 2026-05-01

- Replaced LLM-derived grind settings in recipe generation with a deterministic grind engine that follows the same 5-determinant stacking logic used in the `coffee-recipe-generator` skill (method base -> process -> altitude/origin -> roast -> variety).
- Generation now always overrides `grind` and `range_logic` from this deterministic engine so K-Ultra outputs are stable and consistent across app and skill runs.
- Added unit tests for washed medium-light high-altitude and natural medium-dark low-altitude profiles to verify deterministic grind behavior.

## [1.10.2] - 2026-05-01

- Added explicit Spanish label normalization in bag extraction prompts (`lavado`, `medio claro`, etc.) to reduce misclassification of process and roast level.
- Added a washed-floral profile guardrail in recipe grind logic instructions to bias delicate high-altitude washed coffees toward finer starting points.
- Capped freshness-driven coarsening for washed floral coffees unless roast age is explicitly under 4 days.

## [1.10.1] - 2026-05-01

- Tuned AI grind-calculation prompt rules to reduce systematic coarse bias by shifting brew-method base ranges finer across supported methods.
- Rebalanced process grind offsets (especially natural/honey/anaerobic) to align closer with the `coffee-recipe-generator` determinant framework.
- Corrected density guidance to treat high-altitude coffees as finer-leaning and split Gesha vs Pacamara/Maragogipe variety behavior for better real-world dialing.

## [1.10.0] - 2026-05-01

- Expanded brew method recommendation scoring to include bean-origin pairing rules aligned with the `coffee-recipe-generator` skill matrix.
- Rebalanced process and variety method scoring to better match profile-based pairings (washed/natural/honey/anaerobic and clarity-vs-body variety tendencies).
- Updated recommendation tests to cover origin-based behavior and the revised anaerobic pairing expectations.

## [1.9.3] - 2026-05-01

- Fixed K-Ultra input validation to require dotted `rotation.number.tick` notation so bare integers no longer pass as valid settings.
- Fixed K-Ultra display normalization to treat bare numeric strings as click counts and render them in `R.N.T` format.

## [1.9.2] - 2026-05-01

- Replaced grinder table references with exact Honest Coffee Guide model-specific settings for 1Zpresso K-Ultra, 1Zpresso Q Air, Baratza Encore ESP, and Timemore C2 Fold.
- Added K-Ultra `R.N.T` notation support (`rotation.number.tick`) in recipe edit/manual flows while preserving internal click-based conversion math.
- Updated grind setting parsing/formatting so K-Ultra values are normalized consistently across generation, editing, scaling, and auto-adjust routes.

## [1.9.1] - 2026-04-18

- Improved navigation responsiveness by removing avoidable request waterfalls on the home page and saved recipe detail screens.
- Reduced authenticated route delays by tightening profile bootstrap work in the auth context and profile loader.
- Switched local dev/build scripts back to the default Next.js toolchain and allowed localhost/127.0.0.1 dev origins to avoid broken local navigation assets.

## [1.9.0] - 2026-04-14

- Refactored recipe detail and session components for improved performance and maintainability.
- Split RecipeDetailClient (1015→452 lines) and RecipeSessionClient (734→279 lines) into focused hooks and sub-components.
- Reduced re-render scope by isolating editing, sharing, notes, and history state into dedicated hooks.

## [1.8.3] - 2026-04-14

- Improved navigation responsiveness by fixing potential race conditions in navigation guard logic.
- Memoized navigation components (BottomNav, SideNav) and icon components to reduce unnecessary re-renders.

## [1.8.0] - 2026-04-12

- Added immutable recipe snapshot history for saved recipes.
- Edit History now supports browsing older versions and restoring them safely.
- Older snapshots can be saved as new recipes or reused as the live version without rewriting history.

## [1.7.0] - 2026-04-12

- Refined brew method recommendations with stronger scoring for brew goal, bean freshness, and confidence.
- Improved recommendation quality so method suggestions better match user intent and bean condition.

## [1.6.3] - 2026-04-11

- Added a session-based manual recipe builder.
- Users can now create recipes by hand with stronger validation and clearer manual recipe attribution.

## [1.5.0] - 2026-04-09

- Improved OpenRouter tracking and profile handling for authenticated users.
- Preserved Google profile names more reliably during auth/profile sync.

## [1.5.1] - 2026-04-09

- Authentication is now required before entering scan or manual recipe flows.

## [1.5.7] - 2026-04-09

- Improved performance across recipe, share, and auto-adjust flows.
- Reduced hydration overhead, improved caching, and sped up the home experience.
