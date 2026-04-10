# Performance Audit Plan

## Summary

- [x] Baseline the app with a production build.
- [x] Confirm current rendering split: static utility flows, dynamic saved-recipe flows, and a globally hydrated shell.
- [x] Identify the highest-impact performance bottlenecks from source and build artifacts.
- [ ] Implement the fixes in priority order below.

## Highest-Impact Changes

- [ ] Move auth and profile resolution out of repeated client hooks and into server-rendered route boundaries.
  - `useAuth()` and `useProfile()` currently trigger client auth + profile fetches repeatedly across pages and nested consumers, including duplicate `useAuth()` subscriptions inside `useProfile()`.
  - Replace page-level `useAuth()` / `useProfile()` reads on the home, recipes, settings, analysis, and recipe-detail flows with server-fetched session/profile props or a single shared client context hydrated once per request.
  - Keep `useAuth()` only for truly interactive auth events like sign-out or OAuth button actions.

- [ ] Convert the homepage and recipes index from client-fetch shells into Server Components with small client islands.
  - `/` currently waits for client auth, then fetches `/api/recipes?limit=20` after hydration.
  - `/recipes` currently redirects client-side, fetches the list client-side, and keeps search/filter/pagination entirely in the hydrated tree.
  - Server-render the initial user/profile/list payload, then isolate only search, pagination, and mutating controls as client components.
  - Prefer URL-driven filters/search params for `/recipes` so the first view is streamable and cacheable.

- [ ] Shrink the global hydration surface in the root layout.
  - The root layout wraps every route with client navigation and theme providers, which forces shared JS onto every page.
  - Keep the theme boot script, but reduce or remove the extra mount-time `ThemeProvider` pass if the inline script already establishes the correct class.
  - Move nav-guard behavior closer to the edit flows that need it instead of wrapping the full app tree.
  - Reevaluate whether desktop/mobile nav must be client components on every route, or whether only the guarded navigation paths need client behavior.

- [ ] Narrow middleware auth refresh to routes that actually require it.
  - Middleware currently matches almost every non-static request and always calls `supabase.auth.getUser()`.
  - Exclude clearly public/static routes where a session refresh is not needed, and avoid spending auth round-trips on anonymous landing flows.
  - Validate Supabase SSR guidance before changing matcher scope so auth correctness is preserved.

- [ ] Split the saved recipe detail flow into lighter client islands and remove post-hydration fetches that can be resolved on the server.
  - `RecipeDetailClient` is the largest client module in the repo and still performs follow-up fetches for share state and comment counts after the page already fetched recipe data on the server.
  - Fetch share metadata with the initial page payload when available, and lazy-load only the expensive editing/reordering surface.
  - Keep `SortableStepList` dynamically loaded; extend the same pattern to edit-history, share sheet, and secondary tools if they are not needed on initial paint.

- [ ] Reduce client-only components that are presentational.
  - `RecipeListCard` is a client component but only renders props; make it a Server Component unless a client-only dependency remains.
  - Recheck other pure render components in the home and recipes trees for the same pattern.

## Build and Code Checks

- [ ] Rebuild after each major refactor and record route output changes from `npm run build`.
- [ ] Compare shared client chunk weight before and after the layout/auth refactor.
- [ ] Verify no regression in auth redirects, saved recipe editing, share links, or theme persistence.
- [ ] Add or update tests around server-side redirects and any new server data helpers.

## Audit Evidence

- [x] Production build completed successfully and shows mostly static utility routes with dynamic recipe/share routes.
- [x] Shared client chunks total about `1.3M` under `.next/static/chunks`, indicating meaningful cross-route JS pressure.
- [x] Highest-risk source hotspots:
  - [src/app/layout.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/layout.tsx#L23) keeps `ThemeProvider`, `NavGuardProvider`, `SideNav`, and `BottomNav` in the global shell.
  - [src/hooks/useAuth.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/hooks/useAuth.ts#L7) performs client auth bootstrapping and subscription setup wherever used.
  - [src/hooks/useProfile.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/hooks/useProfile.ts#L14) calls `useAuth()` again and fetches `/api/profile` after hydration.
  - [src/app/page.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/page.tsx#L12) fetches recipes client-side after auth resolves.
  - [src/app/recipes/page.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipes/page.tsx#L15) is a full client page with client-side auth redirect and no-store list fetching.
  - [src/lib/supabase/middleware.ts](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/lib/supabase/middleware.ts#L4) refreshes auth on nearly every matched request.
  - [src/app/recipes/[id]/RecipeDetailClient.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipes/[id]/RecipeDetailClient.tsx#L59) is the largest client module and performs additional share/comment fetches after hydration.
  - [src/components/RecipeListCard.tsx](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/components/RecipeListCard.tsx#L1) is client-only despite being presentational.

## Assumptions

- [x] Primary goal is faster initial load, lower shared JS, and reduced redundant network/auth work rather than deep database/query optimization.
- [x] Supabase SSR behavior must stay correct; performance changes should not weaken session refresh or Google OAuth profile sync.
- [x] The correct version bump, when implementation starts, is at least a patch release unless the work introduces new user-facing behavior.
