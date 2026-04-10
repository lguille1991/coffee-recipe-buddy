# Performance Audit Report - Coffee Recipe Buddy

**Generated:** 2025-04-09  
**Next.js Version:** 16.2.2  
**React Version:** 19.2.4  
**Current App Version:** 1.5.1

---

## Executive Summary

Your Next.js 16 app is well-structured with modern patterns (Server Components, App Router, React 19). However, there are several high-impact performance optimizations that can significantly improve loading times, reduce bundle size, and eliminate request waterfalls.

### Key Metrics
- **Largest Client Components:** RecipeDetailClient.tsx (875 lines), RecipeSessionClient.tsx (365 lines)
- **Hook Usage:** 48 instances of useEffect/useMemo/useCallback
- **Dynamic Imports:** 1 instance (SortableStepList)
- **startTransition Usage:** 4 instances (good!)

---

## Critical Issues (Fix Immediately)

### 1. ❌ Request Waterfalls in Page Components

**Problem:** Multiple pages fetch data sequentially instead of in parallel.

**Affected Files:**
- `src/app/page.tsx` - Fetches recipes AFTER auth loads
- `src/app/analysis/page.tsx` - Fetches profile before extracting data
- `src/app/recipes/[id]/RecipeDetailClient.tsx` - Multiple sequential fetch requests

**Current Pattern (Anti-pattern):**
```tsx
// page.tsx - Waterfall pattern
const { user, loading } = useAuth()  // Wait for auth
// ...later...
useEffect(() => {
  if (!user) return
  fetch('/api/recipes?limit=20')  // Then fetch recipes
}, [user])
```

**Recommendation:**
```tsx
// Use Promise.all() for independent operations
const [userData, recipesData] = await Promise.all([
  getUser(),
  fetchRecipes()  // These can happen in parallel
])
```

---

### 2. ❌ Large Client Components Without Code Splitting

**Problem:** 875-line RecipeDetailClient and 365-line RecipeSessionClient load entirely on initial render.

**Impact:** Large bundle sizes, slower initial load, more JavaScript to parse/execute.

**Recommendation:** Split into smaller components and use dynamic imports:
```tsx
// Instead of everything in one file:
const EditModePanel = dynamic(() => import('./EditModePanel'), { ssr: false })
const ShareSheet = dynamic(() => import('./ShareSheet'), { ssr: false })
const FeedbackSection = dynamic(() => import('./FeedbackSection'), { ssr: false })
```

---

### 3. ❌ No Request Deduplication for Client-Side Fetching

**Problem:** Multiple components fetching the same data independently will cause duplicate requests.

**Affected Files:**
- `useAuth` hook used across many components
- `useProfile` hook refetches on every mount
- RecipeDetailClient makes 3 separate fetch calls (share, comments, etc.)

**Recommendation:** Implement SWR or React Query for:
- Automatic request deduplication
- Caching
- Stale-while-revalidate pattern

```tsx
// Use SWR for client data fetching
import useSWR from 'swr'

export function useProfile() {
  const { data, error } = useSWR('/api/profile', fetcher)
  return { profile: data, loading: !error && !data }
}
```

---

### 4. ❌ Missing React.cache() for Server-Side Deduplication

**Problem:** Server Components may make duplicate Supabase calls for the same data within a single request.

**Recommendation:** Wrap data fetchers with React.cache():
```tsx
import { cache } from 'react'

export const getRecipe = cache(async (id: string) => {
  const supabase = await createClient()
  return supabase.from('recipes').select('*').eq('id', id).single()
})
```

---

## High Impact Issues

### 5. ⚠️ Barrel File Imports

**Problem:** Importing from `@/components` or `@/lib` can pull in unused code.

**Current Pattern:**
```tsx
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
```

**Recommendation:** Import directly from source files to help tree-shaking:
```tsx
// Keep current pattern but ensure no barrel exports
// Each hook should be in its own file (✓ Already doing this)
```

**Status:** ✅ Good - You're already importing directly, not using index.ts barrel files.

---

### 6. ⚠️ Missing Suspense Boundaries

**Problem:** Server Components don't use Suspense for streaming, causing all-or-nothing rendering.

**Affected Files:**
- `src/app/recipes/[id]/page.tsx`
- `src/app/recipes/[id]/brew/page.tsx`

**Recommendation:** Add Suspense boundaries to stream content:
```tsx
import { Suspense } from 'react'

export default async function SavedRecipeDetailPage({ params }) {
  return (
    <Suspense fallback={<RecipeDetailSkeleton />}>
      <RecipeDetail params={params} />
    </Suspense>
  )
}
```

---

### 7. ⚠️ API Routes Don't Start Promises Early

**Problem:** API routes await sequentially instead of starting promises early.

**Example in `src/app/api/generate-recipe/route.ts`:**
```tsx
// Current - Sequential
const body = await req.json()
const beanParsed = BeanProfileSchema.safeParse(bean)
const client = createOpenRouterClient(req)  // Could start earlier
```

**Recommendation:**
```tsx
export async function POST(req: NextRequest) {
  // Start all independent work immediately
  const bodyPromise = req.json()
  const client = createOpenRouterClient(req)
  const supabase = await createClient()
  
  const body = await bodyPromise
  // ...rest
}
```

---

## Medium Impact Issues

### 8. ⚠️ useMemo Without Primitive Dependencies

**Problem:** Some useMemo hooks use object/array dependencies which change reference on every render.

**Affected Files:**
- `RecipeDetailClient.tsx` line 137-145 - Uses `recipe` object
- `RecipeDetailClient.tsx` line 142-145 - Uses `editDraft` object

**Recommendation:** Use primitive dependencies or useMemo with care:
```tsx
// Instead of:
const liveGrindSettings = useMemo(() => {
  return buildLiveGrindSettings(recipe, preferredGrinder, editDraft)
}, [editDraft, isEditing, preferredGrinder, recipe])

// Use primitive deps or derive during render if cheap:
const liveGrindSettings = isEditing && editDraft 
  ? buildLiveGrindSettings(recipe, preferredGrinder, editDraft)
  : null
```

---

### 9. ⚠️ Multiple useEffect Chains

**Problem:** RecipeDetailClient has 6 useEffect hooks that may cascade.

**Recommendation:** Combine related effects or use derived state during render.

---

### 10. ⚠️ Missing Image Optimization for Remote URLs

**Problem:** Remote Supabase images may not be optimized.

**Current:**
```tsx
<Image src={recipe.image_url} ... />
```

**Recommendation:** Ensure Supabase images use Next.js Image optimization or are served via a CDN with proper sizing.

---

## Positive Findings ✅

1. **Using Next.js 16 with App Router** - Modern architecture
2. **Using React 19** - Latest features including startTransition
3. **Using @supabase/ssr** - Correct SSR package (not deprecated auth-helpers)
4. **Proper Server/Client separation** - Good use of Server Components
5. **Dynamic import for DnD** - SortableStepList correctly lazy-loaded
6. **One dynamic import already** - `SortableStepList` uses `next/dynamic`
7. **Good use of startTransition** - 4 instances found
8. **Route handlers use proper params typing** - Following Next.js 16 patterns
9. **Memoized RecipeListCard** - Uses `memo()` correctly

---

## Action Plan (Prioritized)

### Phase 1: Critical (Do First)
- [ ] Install SWR for client-side data fetching and deduplication
- [ ] Add React.cache() wrappers for server data fetchers
- [ ] Split RecipeDetailClient into smaller components with dynamic imports
- [ ] Add Suspense boundaries to Server Component pages

### Phase 2: High Impact
- [ ] Audit and optimize API route promise patterns (start early, await late)
- [ ] Implement proper loading.tsx for all routes
- [ ] Review and fix useMemo dependencies (use primitives)

### Phase 3: Medium Impact
- [ ] Combine related useEffect hooks where possible
- [ ] Add bundle analyzer to track size
- [ ] Optimize image loading for remote URLs

### Phase 4: Polish
- [ ] Add React DevTools Profiler for runtime analysis
- [ ] Test with Lighthouse and WebPageTest
- [ ] Monitor Core Web Vitals in production

---

## Estimated Impact

| Optimization | Bundle Size | Load Time | FID/INP | Effort |
|-------------|-------------|-----------|---------|--------|
| Code Splitting | -20-30% | -15-20% | Medium | Medium |
| SWR Deduplication | - | -30-40% requests | High | Low |
| Suspense Boundaries | - | +streaming | Medium | Low |
| React.cache() | - | -20-30% server | - | Low |
| API Route Optimization | - | -10-15% API | Low | Low |

---

## Files Requiring Attention

**High Priority:**
1. `src/app/recipes/[id]/RecipeDetailClient.tsx` (875 lines) - Split & dynamic import
2. `src/app/recipe/RecipeSessionClient.tsx` (365 lines) - Split & optimize
3. `src/app/page.tsx` - Add parallel data fetching
4. `src/app/recipes/page.tsx` - Optimize infinite scroll pattern

**Medium Priority:**
5. `src/app/api/generate-recipe/route.ts` - Parallelize operations
6. `src/hooks/useProfile.ts` - Add SWR
7. `src/hooks/useAuth.ts` - Add SWR
8. `src/app/recipes/[id]/page.tsx` - Add Suspense
9. `src/app/recipes/[id]/brew/page.tsx` - Add Suspense

---

## Quick Wins (30 minutes each)

1. **Add SWR** - `npm install swr`
2. **Add React.cache()** - Wrap Supabase calls
3. **Add Suspense** - Wrap server components
4. **Fix useMemo deps** - Use primitives only

---

*This audit was generated based on Vercel's React Best Practices guidelines for Next.js 16.*
