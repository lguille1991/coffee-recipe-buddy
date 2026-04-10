# Performance Audit Plan

## Critical Issues (Fix First)

- [ ] **CR-1**: Split `RecipeDetailClient` (875 lines, 25+ useState) into smaller components — extract `RecipeEditor`, `RecipeViewer`, `ShareSheetWrapper`, `EditHistoryWrapper`. Use `useReducer` for edit state; extract into `useRecipeEdit` hook. (`src/app/recipes/[id]/RecipeDetailClient.tsx`)
- [ ] **CR-2**: Convert home page recipe fetch from client-side to server-side. Remove `{ cache: 'no-store' }`. Use Supabase server client in `page.tsx` with streaming/Suspense. (`src/app/page.tsx:22-32`)
- [ ] **CR-3**: Eliminate `useAuth` → `useProfile` waterfall. Create `AuthProvider` and `ProfileProvider` contexts that fetch once and share across all pages. (`src/hooks/useAuth.ts`, `src/hooks/useProfile.ts`)
- [ ] **CR-4**: Add React.memo to all 12 section components in `RecipeSessionSections.tsx` and `RecipeDetailSections.tsx`. Memoize inline arrays/objects with `useMemo`. (`src/app/recipe/_components/RecipeSessionSections.tsx`, `src/app/recipes/[id]/_components/RecipeDetailSections.tsx`)
- [ ] **CR-5**: Move `METHOD_FILTERS` outside component scope to module-level constant. (`src/app/recipes/page.tsx:10-13`)

## High Priority Issues

- [ ] **HI-1**: Convert `auto-adjust/page.tsx` from client-side fetch to server component pattern (like `recipes/[id]/page.tsx` already does). (`src/app/recipes/[id]/auto-adjust/page.tsx:45-61`)
- [ ] **HI-2**: Fix sequential share→comments waterfall in `RecipeDetailClient`. Combine into single API response or fetch in parallel with `Promise.all`. (`src/app/recipes/[id]/RecipeDetailClient.tsx:102-119`)
- [ ] **HI-3**: Add `user_id` filter to `GET /api/recipes/:id` for defense-in-depth (consistent with DELETE/PATCH). (`src/app/api/recipes/[id]/route.ts:15-24`)
- [ ] **HI-4**: Replace `select('*')` with specific column selection in all recipe API routes. (`src/app/api/recipes/[id]/route.ts`, `share/route.ts`, `auto-adjust/route.ts`, `profile/route.ts`)
- [ ] **HI-5**: Add `Cache-Control` headers to all GET API endpoints. (`src/app/api/` — all route handlers)
- [ ] **HI-6**: Remove `{ cache: 'no-store' }` from client-side recipe fetches. (`src/app/page.tsx:27`, `src/app/recipes/page.tsx:36`)
- [ ] **HI-7**: Memoize `NavGuardContext` provider value `{ requestNavigate, setGuard }` with `useMemo`. Memoize `setGuard` with `useCallback`. (`src/components/NavGuardContext.tsx:32-34`)
- [ ] **HI-8**: Wrap `SideNav` and `BottomNav` in `React.memo`. (`src/components/SideNav.tsx`, `src/components/BottomNav.tsx`)
- [ ] **HI-9**: Add dynamic imports (`next/dynamic`) for heavy route components: `ShareRecipeClient`, `BrewModeClient`, `RecipeSessionClient`. (`src/app/share/[token]/page.tsx`, `src/app/recipes/[id]/brew/page.tsx`, `src/app/recipe/page.tsx`)
- [ ] **HI-10**: Deduplicate profile fetches — settings page has its own useEffect for `/api/profile` instead of using `useProfile`. (`src/app/settings/page.tsx:34-47`)

## Medium Priority Issues

- [ ] **ME-1**: Replace `<img>` with `next/image` `<Image>` in `ShareRecipeClient`. (`src/app/share/[token]/ShareRecipeClient.tsx:121-123`)
- [ ] **ME-2**: Add Suspense boundaries around data-fetching client components on all page routes. (`src/app/` — all page.tsx files)
- [ ] **ME-3**: Memoize `useWakeLockTimer.ts` cumulative step index computation with `useMemo`. (`src/app/recipe/_hooks/useWakeLockTimer.ts:131-135`)
- [ ] **ME-4**: Move `createClient()` in `useAuth` to module-level singleton or `useRef` to avoid recreating Supabase client per mount. (`src/hooks/useAuth.ts:11-27`)
- [ ] **ME-5**: Move `createClient()` in `AuthForm` to `useRef`/`useMemo` to avoid re-creation per render. (`src/app/auth/page.tsx:21`)
- [ ] **ME-6**: Add pagination count metadata to `GET /api/recipes` response. (`src/app/api/recipes/route.ts:85-106`)
- [ ] **ME-7**: Consider GIN index or computed FTS column for JSONB `bean_info` text search. (`src/app/api/recipes/route.ts:97-103`)
- [ ] **ME-8**: Use `jsonb_set` or array append for `feedback_history` PATCH instead of sending entire history. (`src/app/recipes/[id]/RecipeDetailClient.tsx:302-313`)
- [ ] **ME-9**: Move `syncProfileDisplayNameFromAuth` to auth callback only, not on every `/api/profile` GET. (`src/lib/auth-profile.ts:25-54`)
- [ ] **ME-10**: Add database indexes: `recipes(user_id, archived, created_at DESC)`, `shared_recipes(share_token)`, `shared_recipes(recipe_id, owner_id)`.
- [ ] **ME-11**: Wrap `backdrop-blur` usage in `@supports (backdrop-filter: blur(1px))` for graceful degradation on low-end devices. (`src/app/globals.css:129,137`)
- [ ] **ME-12**: Debounce sessionStorage writes in `RecipeSessionClient` for recipe state (not just notes). Consider `lz-string` compression. (`src/lib/recipe-session-storage.ts`)
- [ ] **ME-13**: Create a shared recipe data cache (via `stale-while-revalidate` or Next.js cache) so navigating between `/recipes/[id]`, `/recipes/[id]/brew`, `/recipes/[id]/auto-adjust` doesn't require full refetch.

## Low Priority Issues

- [ ] **LO-1**: Remove `will-change-transform` from the base `ui-pressable` utility. Add it only to actively-animating elements. (`src/app/globals.css:113`)
- [ ] **LO-2**: Add a lightweight `/api/recipes/:id/share/comment-count` endpoint or include `commentCount` in the share token response to avoid the separate comments fetch. (`src/app/recipes/[id]/RecipeDetailClient.tsx:114`)