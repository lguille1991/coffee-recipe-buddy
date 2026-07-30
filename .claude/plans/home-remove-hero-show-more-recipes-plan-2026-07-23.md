# Home: Remove Hero Image and Show More Recent Recipes

## Baseline metadata

- Pre-existing dirty files: none (`git status --porcelain=v1` was clean before planning).
- Task-owned files:
  - `src/app/page.tsx`
  - `src/app/page.test.tsx` (new)
  - `src/lib/recipe-list.ts`
  - `src/lib/__tests__/recipe-list.test.ts`
  - `package.json`
  - `package-lock.json`
  - `CHANGELOG.md`
  - `.claude/plans/home-remove-hero-show-more-recipes-plan-2026-07-23.md`

## Implementation plan

- [x] Remove the Home-page hero image block and its unused `next/image` import without adding a replacement visual.
- [x] Keep the primary scan/manual/sign-in actions directly beneath the welcome copy so the main creation paths remain prominent.
- [x] Change the signed-in Home recipe section from six items to the twelve newest active owned recipes:
  - request `limit: 12` from `listRecipesForUser`,
  - request explicit newest-first ordering so older favorites do not displace recent recipes,
  - render the returned list without an additional six-item slice,
  - label the section `Recent Recipes` while preserving the existing `See all` route and empty state.
- [x] Add a focused Home server-page regression test that verifies:
  - the recent-recipe query requests twelve items,
  - all twelve returned recipes are rendered,
  - the removed hero image is absent,
  - guest Home behavior still avoids fetching or rendering saved recipes.
- [x] Apply release hygiene:
  - bump the patch version from `2.0.5` to `2.0.6`,
  - keep `package-lock.json` root metadata synchronized,
  - add a user-facing `CHANGELOG.md` entry describing the cleaner Home layout and expanded recent-recipe list.
- [x] Immediately run the required findings-first review of the task-owned diff; the initial findings were fixed with approval and the repeated review found no remaining issues.

## Deferred validation

- [ ] After review approval and explicit commit-readiness confirmation, run:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- [ ] If validation passes, provide a concise recommended commit message.
