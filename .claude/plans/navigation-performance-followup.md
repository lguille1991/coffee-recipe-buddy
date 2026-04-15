# Navigation Performance Follow-up Plan

This plan addresses additional performance observations discovered during the navigation performance audit that were not included in the immediate fixes.

---

## 1. RecipeDetailClient Component Split

**Priority:** High  
**Impact:** Reduces re-render scope and improves maintainability  
**File:** `src/app/recipes/[id]/RecipeDetailClient.tsx` (1000+ lines)

### Current State
- Single component with 1015 lines
- Complex state management (editing, sharing, notes, history)
- Multiple concerns mixed together

### Action Items
- [ ] Extract `useRecipeEditing` hook for edit-related state and handlers
- [ ] Create `RecipeEditForm` component for the editing UI
- [ ] Extract `useRecipeSharing` hook for share-related logic
- [ ] Create `RecipeShareSheet` component (already partially exists)
- [ ] Extract `useRecipeNotes` hook for notes autosave logic
- [ ] Create `RecipeNotesSection` component
- [ ] Extract `useRecipeHistory` hook for snapshot/version management
- [ ] Consider using React Context for deep prop drilling

### Success Criteria
- No component file exceeds 300 lines
- Each component has a single responsibility
- State updates in one feature don't trigger re-renders in unrelated features

---

## 2. RecipeSessionClient Component Split

**Priority:** High  
**Impact:** Reduces re-render scope and improves maintainability  
**File:** `src/app/recipe/RecipeSessionClient.tsx` (734 lines)

### Current State
- Complex manual recipe + feedback flow state management
- Multiple `useEffect` hooks with interdependencies
- State machine-like logic scattered across useState/useEffect

### Action Items
- [ ] Implement a proper state machine using `useReducer` or XState
- [ ] Extract `useManualRecipe` hook for manual draft management
- [ ] Extract `useFeedbackFlow` hook for adjustment flow
- [ ] Create `ManualRecipeForm` component
- [ ] Create `FeedbackAdjustmentPanel` component
- [ ] Extract session storage synchronization into a custom hook

### Success Criteria
- State transitions are explicit and predictable
- Component renders only when its specific state slice changes
- No prop drilling for flow state

---

## 3. Consolidate useEffect Hooks

**Priority:** Medium  
**Impact:** Prevents cascading updates and race conditions  
**Files:** Multiple components with multiple useEffect hooks

### Current State
Components like RecipeDetailClient have 6+ `useEffect` hooks:
- Freshness calculation effect
- Navigation guard effect  
- Notes debounce cleanup
- Edit history sheet effect
- And more...

### Action Items
- [ ] Audit all useEffect hooks in RecipeDetailClient
- [ ] Group related effects (e.g., all editing-related effects)
- [ ] Use `useCallback` for effect dependencies to stabilize them
- [ ] Consider using `useLayoutEffect` for guard-related effects that must run synchronously
- [ ] Document effect dependencies and execution order

### Success Criteria
- Maximum 3-4 useEffect hooks per component
- Each effect has a clear, single purpose
- No race conditions between effects

---

## 4. Bundle Analysis & Code Splitting

**Priority:** Medium  
**Impact:** Faster initial page loads, smaller JS bundles

### Current State
- Recipe detail page likely loads all editing code even when viewing
- No dynamic imports for heavy components

### Action Items
- [ ] Run `next build --analyze` to identify large bundles
- [ ] Add dynamic imports for:
  - [ ] `SortableStepList` in RecipeDetailClient (already done in one place)
  - [ ] Recipe editing components
  - [ ] Recipe share sheet components
  - [ ] Feedback adjustment UI
- [ ] Verify `loading.tsx` files provide good UX during dynamic import loading
- [ ] Consider route-level code splitting for `/recipes/[id]/brew` and `/recipes/[id]/auto-adjust`

### Success Criteria
- Initial JS bundle for recipe view < 100KB gzipped
- Editing code only loads when entering edit mode
- No layout shift during dynamic component loading

---

## 5. Navigation Prefetching Strategy

**Priority:** Low-Medium  
**Impact:** Faster perceived navigation

### Current State
- Navigation uses `router.push()` without prefetching
- Users experience delay when clicking nav items

### Action Items
- [ ] Evaluate Next.js App Router automatic prefetching behavior
- [ ] Add explicit `prefetch={true}` to Link components where appropriate
- [ ] Consider prefetching on hover for frequently accessed routes
- [ ] Test with network throttling to verify improvement

### Success Criteria
- Navigation feels instant for pre-fetched routes
- No excessive bandwidth usage from over-prefetching

---

## 6. Performance Monitoring Setup

**Priority:** Low  
**Impact:** Data-driven performance improvements

### Action Items
- [ ] Add React DevTools Profiler recordings to PR checklist
- [ ] Consider adding web-vitals monitoring (CLS, FID, LCP, INP)
- [ ] Set up performance budgets in CI/CD

---

## Implementation Order

1. **Phase 1 (Immediate):** Component splitting for RecipeDetailClient
2. **Phase 2:** Component splitting for RecipeSessionClient  
3. **Phase 3:** useEffect consolidation and state machine refactor
4. **Phase 4:** Bundle analysis and code splitting
5. **Phase 5:** Prefetching strategy and monitoring

---

## Notes

- All changes should include tests where applicable
- Profile before and after each phase to measure improvement
- Consider using React Compiler (when stable) for automatic memoization
