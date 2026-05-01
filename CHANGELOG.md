# Changelog

All notable product-facing changes are documented here.

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
