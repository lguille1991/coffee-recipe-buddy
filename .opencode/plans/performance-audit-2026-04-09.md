# Performance Improvement Plan: Coffee Recipe Buddy

**Generated:** 2026-04-09
**Status:** Pending Approval

---

## Priority 1: Critical Issues

### 1. Add OpenRouter Request Timeouts
**File:** `src/lib/openrouter.ts`
**Problem:** OpenAI client has no timeout (defaults to 10min). Requests can hang indefinitely, blocking server resources.
**Fix:**
- Add `timeout: 30_000` to the OpenAI client constructor
- Add `fetch` override with `AbortSignal.timeout(30_000)`
- This fixes: `generate-recipe`, `extract-bean`, `auto-adjust` routes

### 2. Add Cache-Control Headers to Public Share Endpoints
**Files:**
- `src/app/api/share/[token]/route.ts`
- `src/app/api/share/[token]/comments/route.ts`
**Problem:** Public endpoints return data without caching headers, causing unnecessary DB load on every request.
**Fix:** Add response header before return:
```ts
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

### 3. Cache Markdown Docs at Module Level
**File:** `src/lib/prompt-builder.ts`
**Problem:** `fs.readFileSync()` reads 6 markdown files on every `buildRecipePrompt()` call (every recipe generation).
**Fix:** Cache document contents at module level using a Map or object:
```ts
const CACHED_DOCS = new Map<string, string>()
function readDoc(relativePath: string): string {
  if (!CACHED_DOCS.has(relativePath)) {
    const full = path.join(process.cwd(), 'docs', relativePath)
    CACHED_DOCS.set(relativePath, fs.readFileSync(full, 'utf-8'))
  }
  return CACHED_DOCS.get(relativePath)!
}
```

---

## Priority 2: High Priority Issues

### 4. Optimize N+1 Query in Comments Endpoint
**File:** `src/app/api/share/[token]/comments/route.ts`
**Problem:** Two sequential queries: (1) verify share token exists, (2) fetch comments. The verification query is redundant if `recipe_comments.share_token` has proper foreign key/index.
**Fix:** Remove the token verification query (lines 23-32) and rely on the index. If comments exist with that token, the token is valid.

### 5. Add Route Matcher to Skip Auth Refresh on Public Routes
**File:** `src/lib/supabase/middleware.ts` + `middleware.ts`
**Problem:** `supabase.auth.getUser()` runs on every request, adding latency even for public endpoints.
**Fix:** Add route matcher to middleware config to exclude public share routes:
```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Exclude public share routes from auth refresh
    '/((?!api/share/[^/]+).*)',  // exclude /api/share/:token and sub-routes
  ],
}
```
Or use `next: { missing: [] }` cookie strategy for Edge-compatible approach.

### 6. Add Retry Logic to extract-bean Route
**File:** `src/app/api/extract-bean/route.ts`
**Problem:** No retry on JSON parse failure, unlike `generate-recipe` which has 2 retries.
**Fix:** Add retry loop similar to `generate-recipe`:
```ts
const MAX_RETRIES = 2
// Loop with retry prompts on parse/validation failure
```

---

## Priority 3: Medium Priority Issues

### 7. Add Circuit Breaker for OpenRouter Calls
**Files:** API routes calling OpenRouter (`generate-recipe`, `extract-bean`, `auto-adjust`)
**Problem:** No circuit breaker - OpenRouter failures cascade.
**Fix:** Implement simple retry-with-backoff or use `opossum` library:
```ts
async function withRetry(fn: () => Promise<T>, maxRetries = 2): Promise<T>
```

### 8. Use Binary Search for Grinder Tables
**File:** `src/lib/grinder-converter.ts`
**Problem:** Linear search over 20-22 entry tables is O(n).
**Fix:** Use `Array.binarySearch()` or bisect algorithm if tables grow. Low priority since tables are small.

### 9. Pre-compile Regex Patterns in adjustment-engine
**File:** `src/lib/adjustment-engine.ts`
**Problem:** Regex patterns in `parseClickValue`, `parseRatioNumber` compiled per-call.
**Fix:** Move regex patterns to module-level constants.

---

## Priority 4: Low Priority / Nice to Have

### 10. Verify Database Indexes
**Problem:** Likely missing composite index on `recipes(user_id, archived)`.
**Fix:** Add to Supabase migration or docs/ADR.

### 11. Profile Sync Optimization
**File:** `src/lib/auth-profile.ts`
**Problem:** `syncProfileDisplayNameFromAuth` runs on every profile fetch when display_name is blank.
**Fix:** Add caching or skip sync if recently synced (within session).

---

## Implementation Order

1. [ ] `src/lib/openrouter.ts` - Add timeout configuration
2. [ ] `src/lib/prompt-builder.ts` - Cache markdown docs at module level
3. [ ] `src/app/api/share/[token]/route.ts` - Add Cache-Control header
4. [ ] `src/app/api/share/[token]/comments/route.ts` - Add Cache-Control header + remove N+1 query
5. [ ] `middleware.ts` - Add route matcher to skip auth refresh on public routes
6. [ ] `src/app/api/extract-bean/route.ts` - Add retry logic
7. [ ] `src/lib/adjustment-engine.ts` - Pre-compile regex patterns
8. [ ] (Optional) Add circuit breaker pattern for OpenRouter calls

---

## Verification

After implementing, verify with:
- `npm run lint` - ESLint passes
- `npm run build` - Production build succeeds
- `npm run test` - All tests pass
- Manual testing of share endpoints for cache headers
