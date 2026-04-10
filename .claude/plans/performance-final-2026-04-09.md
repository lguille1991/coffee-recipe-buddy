# Final Performance Plan

Generated: 2026-04-09
Validated against: source, current build output, and the five prior audit files

## What was validated

- [x] Production build succeeds with `npm run build` and confirms the current route split:
  - Static: `/`, `/analysis`, `/auth`, `/manual`, `/methods`, `/recipe`, `/recipes`, `/scan`, `/settings`
  - Dynamic: `/recipes/[id]`, `/recipes/[id]/auto-adjust`, `/recipes/[id]/brew`, `/share/[token]`, and API routes
- [x] Several fixes from the earlier audit have already shipped and should not be replanned:
  - `SortableStepList` is already lazy-loaded via `next/dynamic`
  - route `loading.tsx` files already exist for `analysis`, `recipes`, `recipes/[id]`, `recipes/[id]/brew`, and `share/[token]`
  - most recipe cards already use `next/image`
  - the recipes search flow already aborts in-flight requests
- [x] The remaining issues below are all backed by local code evidence, not just by generic best practices.

## Priority 1

- [x] Move auth and profile loading out of repeated client hooks and into server route boundaries or one shared hydrated client context.
  - Evidence:
    - `useProfile()` calls `useAuth()` internally, then fetches `/api/profile` after auth resolves (`src/hooks/useProfile.ts`)
    - `useAuth()` itself creates a client, calls `supabase.auth.getUser()`, and subscribes on every mount (`src/hooks/useAuth.ts`)
    - These hooks are used across the app shell and feature routes: `/`, `/manual`, `/analysis`, `/recipe`, `/recipes`, `/recipes/[id]`, `/recipes/[id]/auto-adjust`, `/recipes/[id]/brew`, `/scan`, `/settings`, `/share/[token]`
  - Why this stays in the final plan:
    - It removes duplicate auth bootstrapping and profile fetches.
    - It shortens time-to-useful-content on pages that currently wait for client auth before showing personalized state.

- [x] Convert the home page and recipes index from client-fetch shells into server-rendered pages with small client islands.
  - Evidence:
    - `/` is a client page that waits for `useAuth()` and then fetches `/api/recipes?limit=20` with `cache: 'no-store'` (`src/app/page.tsx`)
    - `/recipes` is a client page that redirects client-side, fetches the list client-side, and keeps search/filter/pagination in the hydrated tree (`src/app/recipes/page.tsx`)
    - The build output shows both routes are currently prerendered static, so recipe data is not part of initial HTML today.
  - Why this stays in the final plan:
    - It addresses both the auth/profile waterfall and the client-only list bootstrap on the app’s two most important saved-recipe entry points.
  - Implementation note:
    - Keep search, filters, and pagination as client islands.
    - Prefer URL-driven search params for `/recipes` so the first render is streamable and cacheable.

- [x] Shrink the globally hydrated root layout.
  - Evidence:
    - `src/app/layout.tsx` wraps every route in `ThemeProvider`, `NavGuardProvider`, `SideNav`, and `BottomNav`
    - `ThemeProvider` is a client component that runs a mount effect even though an inline theme boot script already executes in `<head>` (`src/components/ThemeProvider.tsx`)
    - `SideNav` and `BottomNav` are both client components and both depend on `useNavGuard()` plus route state (`src/components/SideNav.tsx`, `src/components/BottomNav.tsx`)
  - Why this stays in the final plan:
    - Shared layout JS is guaranteed to load on every route, including routes that do not need guarded navigation behavior.
  - Implementation note:
    - Keep the inline theme boot script.
    - Move navigation guard wiring closer to edit flows instead of the entire app tree.

- [x] Remove the share metadata and comment-count request chain from the recipe detail page’s initial client mount.
  - Evidence:
    - The server page already fetches the recipe before rendering (`src/app/recipes/[id]/page.tsx`)
    - The client then fetches `/api/recipes/:id/share`, stores `shareToken`, and only after that fetches `/api/share/:token/comments?page=1` to get the count (`src/app/recipes/[id]/RecipeDetailClient.tsx`)
  - Why this stays in the final plan:
    - This is a real post-hydration waterfall on a key dynamic route.
  - Implementation note:
    - Fetch share metadata as part of the initial page payload.
    - Return `commentCount` with that same payload or otherwise remove the dependent second request.

## Priority 2

- [ ] Narrow middleware session refresh so public routes do not always pay for `supabase.auth.getUser()`.
  - Evidence:
    - `middleware.ts` matches almost every non-static request
    - `src/lib/supabase/middleware.ts` always calls `supabase.auth.getUser()`
    - Public share routes such as `/share/[token]`, `/api/share/[token]`, and `/api/share/[token]/comments` are currently inside that matcher
  - Why this stays in the final plan:
    - It adds avoidable auth work to anonymous/public traffic.
  - Guardrail:
    - Validate the final matcher against `@supabase/ssr` session-refresh requirements before narrowing it.

- [ ] Stop bootstrapping saved-recipe subflows with client fetches when the server already has the route param and auth context.
  - Evidence:
    - `/recipes/[id]/auto-adjust` is a client page that fetches `/api/recipes/:id` after mount (`src/app/recipes/[id]/auto-adjust/page.tsx`)
    - The recipe detail route already demonstrates the server-side ownership check pattern (`src/app/recipes/[id]/page.tsx`)
  - Why this stays in the final plan:
    - This is the same avoidable client bootstrap pattern as the home and recipes pages, just on a smaller route.

- [ ] Add caching headers to the public share GET endpoints.
  - Evidence:
    - `GET /api/share/[token]` returns JSON without a `Cache-Control` header (`src/app/api/share/[token]/route.ts`)
    - `GET /api/share/[token]/comments` returns JSON without a `Cache-Control` header (`src/app/api/share/[token]/comments/route.ts`)
    - By contrast, some private GET routes already set explicit cache headers (`src/app/api/profile/route.ts`, `src/app/api/recipes/[id]/share/route.ts`)
  - Why this stays in the final plan:
    - These are public read endpoints and are the clearest place to cut repeat DB work safely.

- [ ] Cache prompt-builder docs at module scope instead of rereading them on every recipe generation call.
  - Evidence:
    - `buildRecipePrompt()` reads seven markdown files through `fs.readFileSync()` every time it runs (`src/lib/prompt-builder.ts`)
    - `generate-recipe` calls `buildRecipePrompt()` on every request (`src/app/api/generate-recipe/route.ts`)
  - Why this stays in the final plan:
    - This is a straightforward server-side hot path optimization with low product risk.

- [ ] Add an explicit timeout in the shared OpenRouter client helper.
  - Evidence:
    - `createOpenRouterClient()` sets headers and base URL but no timeout or abort behavior (`src/lib/openrouter.ts`)
    - The shared helper is used by `extract-bean`, `generate-recipe`, and `auto-adjust`
  - Why this stays in the final plan:
    - Long-hanging LLM calls tie up route handlers and inflate tail latency.
  - Guardrail:
    - Keep this centralized in `src/lib/openrouter.ts`, not ad hoc in route handlers.

## Priority 3

- [ ] Replace broad `select('*')` reads on the recipe detail path with explicit columns.
  - Evidence:
    - The server detail page selects `*` from `recipes` (`src/app/recipes/[id]/page.tsx`)
    - `GET /api/recipes/:id` also selects `*` (`src/app/api/recipes/[id]/route.ts`)
    - `/recipes/[id]/auto-adjust` fetches the source recipe via `select('*')` as well (`src/app/api/recipes/[id]/auto-adjust/route.ts`)
  - Why this stays in the final plan:
    - The recipe rows contain large JSON fields; narrowing the projection is a credible low-risk reduction in payload and serialization work.

- [ ] Decide whether the settings page should keep its own profile fetch or join the shared profile-loading path from Priority 1.
  - Evidence:
    - `/settings` calls `useAuth()` and then separately fetches `/api/profile` inside its own effect instead of using `useProfile()` (`src/app/settings/page.tsx`)
  - Why this stays in the final plan:
    - It is another duplicate profile bootstrap path, but it is lower priority because the broader auth/profile refactor should resolve it naturally.

## Excluded From The Final Plan

- [x] Do not re-add already completed work such as `SortableStepList` lazy loading, `loading.tsx` skeleton routes, most `next/image` replacements, or abortable recipe search.
- [x] Do not include “remove the share existence check from comments GET” as a validated fix.
  - Current code intentionally returns `404` for invalid share tokens before querying comments.
  - Removing that query changes behavior and cannot be justified from local code alone.
- [x] Do not include “convert `RecipeListCard` to a Server Component” as a standalone item.
  - It is imported by client pages today, so it only makes sense as part of the larger page serverization work.
- [x] Do not include “add Cache-Control to all GET endpoints”.
  - Several private endpoints already set deliberate cache policies, and recipe list/detail routes currently opt into `no-store` for correctness.
- [x] Do not include generic SWR/React Query adoption, blanket `React.cache()` wrapping, or broad `useMemo` cleanups without route-specific proof.

## Recommended Order

1. [x] Refactor auth/profile loading and serverize `/` plus `/recipes`.
2. [x] Shrink the global layout hydration surface.
3. [x] Fix the recipe detail share/comment waterfall.
4. [ ] Narrow middleware auth refresh safely.
5. [ ] Serverize `/recipes/[id]/auto-adjust`.
6. [ ] Add public share endpoint caching.
7. [ ] Cache prompt docs and add OpenRouter timeouts.
8. [ ] Narrow broad recipe row selections.
