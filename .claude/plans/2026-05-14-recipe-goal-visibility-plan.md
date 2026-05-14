# Recipe Goal Visibility Plan

## Baseline Metadata
- [x] Pre-existing dirty files at plan start: none observed via `git status --short`.
- [x] Task-owned files expected to be involved:
- [x] `src/types/recipe.ts`
- [x] `src/app/api/recipes/route.ts`
- [x] `src/lib/recipe-list.ts`
- [x] `src/components/RecipeListCard.tsx`
- [x] `src/components/SelectableRecipeListCard.tsx`
- [x] `src/app/recipes/[id]/_components/RecipeDetailSections.tsx`
- [x] `src/components/RecipeListCard.test.tsx`
- [x] `src/app/recipes/[id]/_components/RecipeDetailSections.test.tsx`
- [x] `src/lib/__tests__/recipe-detail.test.ts`
- [x] `src/app/recipes/RecipesClient.test.tsx`
- [x] `src/app/recipes/[id]/route-pages.test.tsx`
- [x] `package.json`
- [x] `CHANGELOG.md`

## Current-State Findings
- [x] Confirm the canonical domain term currently in code for user brewing intent.
- [x] Finding: generation flows already use `goal: BrewGoal` (`clarity`, `balanced`, `sweetness`, `body`, `forgiving`).
- [x] Finding: saved recipe list items do not currently expose goal.
- [x] Finding: saved recipe detail does not expose goal as structured data; profile-generated recipes only append it into `recipe.objective` text (`Target goal: ...`).

## Product Decisions To Resolve
- [x] Confirm whether product copy should standardize on `goal` or keep `intent` as the user-facing term.
- [x] Decision: standardize on `goal`; do not introduce a separate `intent` concept.
- [x] Confirm the fallback behavior for recipes that have no structured goal today (manual recipes, legacy recipes, or recipes saved outside profile generation).
- [x] Decision: render goal only when a structured persisted goal exists; do not infer from `objective` text.
- [x] Confirm whether the list card should show goal as a badge, metadata line, or inline with method badges.
- [x] Decision: render goal as a small badge in the existing card meta/badge cluster.
- [x] Confirm where goal should appear in recipe detail: title block, parameters section, or a dedicated context section.
- [x] Decision: render goal in the recipe detail title block near the method name and other top-level badges.
- [x] Confirm whether share screens should also display goal for consistency, or if scope stays limited to saved recipe list/detail.
- [x] Decision: keep this first pass scoped to saved recipe list/detail only.
- [x] Confirm whether recipes without a persisted goal should show an explicit empty-state label.
- [x] Decision: leave recipes without a persisted goal visually unchanged; do not render placeholder goal copy.
- [x] Confirm the badge copy treatment for recipes with a goal.
- [x] Decision: render the humanized value only (for example `Sweetness`, `Body`), not `Goal: Sweetness`.
- [x] Confirm whether goal badges should use distinct colors by goal or a single visual style.
- [x] Decision: use one shared badge style for all goals in this first pass.

## Proposed Implementation Shape
- [x] Extend saved-recipe TypeScript contracts so list/detail payloads can expose an optional structured `goal`.
- [x] Expand saved recipe read paths to select `generation_context` and map `generation_context.goal` into the new optional list/detail `goal` field.
- [x] Keep writes unchanged for this pass because `generation_context.goal` is already persisted during profile-based recipe generation.
- [x] Render the goal in `RecipeListCard` and `SelectableRecipeListCard` as a humanized badge in the existing meta/badge cluster, using one shared badge style.
- [x] Render the goal in recipe detail as a humanized top-of-page badge in the title block, alongside the existing high-signal badges.
- [x] Render nothing for recipes whose saved payload does not include a structured goal.
- [x] Keep shared recipe pages unchanged in this pass.
- [x] Add regression tests for list rendering and detail rendering across recipes with and without a goal.
- [x] Apply release hygiene if implementation changes runtime behavior:
- [x] bump `package.json` with a SemVer-appropriate version
- [x] add a user-facing `CHANGELOG.md` entry

## Review And Validation Workflow
- [x] After implementation, run a findings-first review of the owned diff.
- [x] If review is clean, ask for commit-readiness confirmation before validation.
- [x] After commit-readiness approval, run `npm test`, `npm run lint`, and `npm run build`.
- [x] Provide at least one concise suggested commit message if validation passes.
