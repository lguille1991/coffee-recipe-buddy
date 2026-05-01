# Save-Only Coffee Profile Flow

## Goal
Allow users to save scanned coffee profiles without forcing immediate recipe generation.

## Analysis Page Behavior
When saved coffee profiles are enabled and the user is authenticated, analysis shows two actions:
- `Save Coffee`
- `Save + Generate Recipe`

When the feature is disabled (or no authenticated user), analysis keeps only generation behavior.

## Save Coffee Branch
- Saves profile via `POST /api/coffee-profiles`.
- Stays on `/analysis` and shows:
  - `Coffee saved`
  - `View Saved Coffee`
  - `Generate Recipe Now`
- Clears scan/recipe session keys that could restore stale generation state.
- Does not set recipe generation session keys.

## Save + Generate Branch
- Preserves existing generation path behavior:
  - stores confirmed bean + recommendations
  - routes to `/methods`
- Profile save attempt is non-blocking for generation when enabled.

## Later Generation Semantics
- Saved scanned coffees generate later from `/coffees/[id]` detail flow.
- This is intentionally different from the immediate scan-time recommendation flow.

## Duplicate Strategy
- Current strategy: allow duplicates.
- Future enhancement can add duplicate detection and merge prompts.
