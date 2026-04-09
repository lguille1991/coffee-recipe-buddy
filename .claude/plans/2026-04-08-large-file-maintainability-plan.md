# Large File Maintainability Plan

## Summary

- [ ] Reduce the main maintenance hotspots first: [`src/app/recipes/[id]/page.tsx`](./src/app/recipes/[id]/page.tsx), [`src/app/recipe/page.tsx`](./src/app/recipe/page.tsx), [`src/app/manual/page.tsx`](./src/app/manual/page.tsx), and [`src/app/recipes/[id]/auto-adjust/page.tsx`](./src/app/recipes/[id]/auto-adjust/page.tsx).
- [ ] Treat file length as a symptom, not the main problem. The primary issue is that route files currently mix server concerns, client orchestration, domain logic, transient UI state, and large render trees.
- [ ] Refactor toward Next.js 16 App Router boundaries: server-first pages, narrow client islands, async route params, and smaller data payloads crossing the server/client boundary.

## Implementation Changes

- [ ] Convert route entry files into thin orchestrators. Target shape:
  - page.tsx loads data and chooses sections.
  - One client wrapper owns interactive state only when server rendering is not viable.
  - Feature sections live beside the route in `_components/`, `_hooks/`, and `_lib/`.
- [ ] For oversized client pages, split by responsibility before splitting by visuals. Recommended seams:
  - Recipe session state and persistence.
  - Sharing flow.
  - Notes autosave.
  - Step editing and validation.
  - Timer and wake-lock behavior.
  - Delete / reset / revoke confirmation flows.
- [ ] Move pure domain logic out of route files into `src/lib/recipe/` submodules. Specifically extract step scaling, accumulated-water recomputation, grind conversion orchestration, recipe edit diffing, and validation helpers from route files.
- [ ] Replace route-local fetch-in-`useEffect` patterns with server data loading where possible. For pages such as [`src/app/recipes/[id]/page.tsx`](./src/app/recipes/[id]/page.tsx), load the recipe in a Server Component and pass only the minimal serialized data needed by the interactive client subtree.
- [ ] Keep client components focused on interactivity. If a component only formats or renders recipe data, keep it server-compatible and remove `'use client'`.
- [ ] Standardize feature folders for large routes. Recommended structure:
  - `src/app/recipes/[id]/page.tsx`
  - `src/app/recipes/[id]/RecipeDetailClient.tsx`
  - `src/app/recipes/[id]/_components/*`
  - `src/app/recipes/[id]/_hooks/*`
  - `src/app/recipes/[id]/_lib/*`
- [ ] Introduce custom hooks only for cohesive behavior, not as “misc” buckets. Good candidates in this repo:
  - `useRecipeDraft`
  - `useRecipeNotesAutosave`
  - `useShareRecipe`
  - `useWakeLockTimer`
  - `useUnsavedChangesGuard`
- [ ] Reduce sessionStorage sprawl by wrapping the current multi-page recipe flow behind a typed storage adapter. Centralize keys, parsing, defaults, migrations, and cleanup for `recipe`, `recipe_original`, `confirmedBean`, `feedback_round`, `adjustment_history`, and related values.
- [ ] For React 19, remove unnecessary memoization during refactors. Keep `useMemo` and `useCallback` only where they protect heavy child trees or third-party drag/drop behavior; otherwise prefer simpler render code and component extraction.
- [ ] Prefer `startTransition` and `useDeferredValue` only for actual non-urgent or expensive UI updates. Do not use them as blanket fixes for large components.
- [ ] Keep API route handlers thin and deterministic. In handlers such as [`src/app/api/recipes/[id]/auto-adjust/route.ts`](./src/app/api/recipes/[id]/auto-adjust/route.ts), extract prompt building, retry policy, recipe scaling, and response parsing into dedicated server-only modules.
- [ ] Preserve Next.js 16 conventions during all splits:
  - Always `await params` in route handlers.
  - Keep Supabase access in `src/lib/supabase/server.ts` or `src/lib/supabase/client.ts`.
  - Prefer route-level loading states and Suspense boundaries over giant all-or-nothing client pages.

## Tailwind / UI Structure

- [ ] Keep `globals.css` for tokens, theme variables, and a small set of cross-app utilities only. Avoid adding feature-specific utilities there as files are split.
- [ ] Extract repeated recipe UI blocks into dedicated components instead of long utility strings repeated inline. Good candidates:
  - stat / parameter cards
  - section headers
  - alert panels
  - action bars
  - form fields and chip groups
- [ ] Use Tailwind v4 intentionally:
  - tokens in `@theme` / CSS variables
  - reusable app-wide primitives in `@utility`
  - feature-specific styling kept local to components
- [ ] Do not create “style-only wrapper components” that just hide Tailwind classes with no behavior or semantic value. Extract a component only when it represents a stable UI concept used across screens.

## Test Plan

- [ ] Add or expand unit tests around extracted pure logic before moving UI:
  - step validation
  - water scaling / accumulation
  - grind conversion and display mapping
  - edit diff generation
  - storage parsing / migration helpers
- [ ] Add integration coverage for the highest-risk route flows:
  - load saved recipe
  - edit recipe and save
  - brew-again flow
  - share / revoke share
  - autosave notes
  - auto-adjust happy path and validation failures
- [ ] Set a refactor acceptance target for route files:
  - no page file over ~250 to 350 lines
  - no client component owning more than one major concern
  - pure helpers moved out once they exceed a few short functions

## Assumptions

- [ ] Use server-first composition as the default target because the app is on Next.js 16 App Router and most current large files are client-heavy.
- [ ] Keep the current visual design and user flows intact; this plan is a maintainability refactor, not a redesign.
- [ ] Centralize the recipe session flow incrementally instead of replacing sessionStorage in one step, because multiple pages currently depend on it.
