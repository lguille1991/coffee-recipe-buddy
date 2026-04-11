# Code Review Remediation Plan

## Priority 1: Correctness and data handling

- [x] Revisit the tracking ID policy in [src/lib/openrouter.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/openrouter.ts:1) and decide explicitly whether provider-facing IDs should optimize for operator readability, privacy, or a hybrid format.
- [x] If readable names remain intentional for OpenRouter cost attribution, document that exception clearly in `AGENTS.md` or code comments so future reviewers do not treat it as an accidental convention break.
- [x] Make the chosen identifier format stable enough for reporting, for example by using a predictable readable slug or a hybrid format such as `crp:<display-slug>:<supabase-user-id>` if you need both legibility and uniqueness.
- [x] Add or update focused tests around the OpenRouter helper to assert the chosen authenticated and guest tracking ID policy stays consistent.

- [x] Audit mutation flows in [src/app/share/[token]/ShareRecipeClient.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/share/%5Btoken%5D/ShareRecipeClient.tsx:1) and [src/app/recipes/[id]/RecipeDetailClient.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipes/%5Bid%5D/RecipeDetailClient.tsx:1).
- [x] Change destructive and autosave actions so local UI state is updated only after confirming `response.ok`.
- [x] Surface a visible error path for failed share/comment/delete/autosave requests instead of silently assuming success.
- [x] Add tests for failed mutation responses so the UI does not clear local state, navigate away, or claim success on backend failure.

- [x] Harden pagination parsing in [src/app/api/share/[token]/comments/route.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/api/share/%5Btoken%5D/comments/route.ts:1) by validating `page` with `Number.isFinite`.
- [x] Fall back to page `1` for malformed query values and preserve a non-500 response for bad input.
- [x] Add a route test that covers invalid `page` input and verifies the handler stays stable.

## Priority 2: Reduce maintainability risk

- [x] Extract a shared grinder-derivation helper used by [src/lib/adjustment-engine.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/adjustment-engine.ts:1), [src/app/recipes/[id]/_lib/editing.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipes/%5Bid%5D/_lib/editing.ts:1), and [src/lib/recipe-migrations.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/recipe-migrations.ts:1).
- [x] Define the helper boundary so one source of truth derives the full grinder bundle from canonical grinder inputs.
- [x] Refactor the three current call sites to consume the shared helper instead of rebuilding overlapping grinder logic inline.
- [x] Add cross-module tests that prove editing, adjustment, and migration flows derive consistent grinder values from the same input.

- [x] Replace string-parsed behavior in [src/lib/adjustment-engine.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/adjustment-engine.ts:1) and [src/lib/freshness-recalculator.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/freshness-recalculator.ts:1) with structured fields.
- [x] Move semantics like roast/process logic, click offsets, and range behavior into explicit typed data rather than human-readable strings.
- [x] Keep presentation strings as a final rendering concern so prompt wording or localization changes cannot alter runtime logic.
- [x] Add tests that lock behavior to structured inputs rather than string fragments such as `"clicks"` or `"natural"`.

- [x] Centralize method ratio bounds currently duplicated between [src/lib/adjustment-engine.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/adjustment-engine.ts:1) and [src/lib/recipe-validator.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/recipe-validator.ts:1).
- [x] Expose a shared policy table or helper that both validation and adjustment use.
- [x] Add a regression test that fails if the validator and adjustment engine drift on supported ratio ranges.

## Priority 3: Verification and rollout

- [x] Read the relevant Next.js guide in `node_modules/next/dist/docs/` before touching any affected route handlers or App Router files, per repository instructions.
- [x] Bump `package.json` version in the same implementation change set using SemVer patch or minor logic based on the final scope.
- [x] Run the focused Vitest suites covering OpenRouter, share routes, recipe editing, adjustment, migrations, and freshness recalculation after the fixes.
- [x] Run the broader test command used by the repo if the focused suites pass cleanly.
- [x] Summarize any residual risk that remains if cross-module policy invariants still are not fully enforced by tests.
Residual risk: the new regression tests cover the guarded mutation helpers and cross-module policy invariants, but they still stop short of browser-level interaction coverage for client components.

## Suggested implementation order

- [x] Fix the OpenRouter identifier issue first because it is isolated and touches external data handling.
- [x] Fix mutation error handling and pagination validation next because they affect user-visible correctness.
- [x] Extract shared recipe-policy helpers after correctness fixes are merged or proven stable.
- [x] Finish by strengthening cross-module tests so future policy changes fail loudly instead of drifting silently.
