# Performance Improvements Plan

## Critical

- [x] **Eliminate share → comments sequential chain** (`src/app/recipes/[id]/page.tsx`)
  - Recipe fetch and share fetch already run in parallel — that part was fine
  - Extracted comments count fetch into a separate `useEffect` keyed on `shareToken`
  - Comments now load reactively and independently, not nested inside the share callback

## High Impact

- [x] **Replace `<img>` with `next/image`** — all recipe thumbnails and cards
  - `src/app/recipes/page.tsx` — recipe list card image
  - `src/app/page.tsx` — homepage recipe card
  - `src/app/recipes/[id]/page.tsx` — bag photo on detail page
  - Configured `next.config.ts` with `remotePatterns` for `*.supabase.co` and `images.unsplash.com`

- [x] **Fix hero image** (`src/app/page.tsx`)
  - Replaced inline `backgroundImage` CSS with `<Image fill priority />` inside a `relative` container

- [x] **Split recipe detail into lazy-loaded sub-components**
  - Extracted `SortableStepRow` + all dnd-kit imports into `src/app/recipes/[id]/SortableStepList.tsx`
  - Dynamically imported via `dynamic(() => import('./SortableStepList'), { ssr: false })`
  - dnd-kit bundle (~50 KB) now only loads when user enters edit mode

## Medium Impact

- [x] **Add `loading.tsx` skeleton screens**
  - `src/app/recipes/loading.tsx`
  - `src/app/recipes/[id]/loading.tsx`
  - `src/app/analysis/loading.tsx`
  - `src/app/share/[token]/loading.tsx`
  - These cover the navigation transition; in-component loading state still uses existing spinners

- [x] **Add `Cache-Control` headers to GET API routes**
  - `src/app/api/recipes/route.ts` — `private, max-age=60`
  - `src/app/api/recipes/[id]/route.ts` — `private, max-age=60`
  - `src/app/api/profile/route.ts` — `private, max-age=3600`
  - `src/app/api/recipes/[id]/share/route.ts` — `private, max-age=300`

- [ ] **Break `useProfile` waterfall** (`src/hooks/useProfile.ts:14–32`)
  - Not implemented — requires moving profile loading to a Server Component layout
  - Real fix: fetch profile server-side in the root layout and pass as prop

- [x] **Add `React.memo` + `useCallback`**
  - `RecipeCard` in `src/app/recipes/page.tsx` — wrapped with `memo`
  - `RecipeCard` in `src/app/page.tsx` — wrapped with `memo`
  - `SortableStepRow` in `SortableStepList.tsx` — wrapped with `memo`
  - `handleStepUpdate`, `handleStepDelete`, `handleStepAdd`, `handleReorder` — all wrapped with `useCallback` in parent

## Low Impact / Polish

- [x] **Add `AbortController` to search debounce** (`src/app/recipes/page.tsx`)
  - Cancels in-flight request when user types again before 400ms elapses
  - Handles `AbortError` gracefully without clearing results

- [ ] **Add virtual scrolling for large recipe lists** (`src/app/recipes/page.tsx`)
  - Deferred — low priority until recipe count becomes a real use case

- [ ] **Add Error Boundaries**
  - Deferred — nice-to-have, not impactful for current load performance
