# Changelog

All notable product-facing changes are documented here.

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
