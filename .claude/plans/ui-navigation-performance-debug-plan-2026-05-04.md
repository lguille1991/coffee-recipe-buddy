# UI Navigation Performance Debug Plan (2026-05-04)

## Baseline Metadata
- [x] Pre-existing dirty files recorded (`git status --short`):
  - Deleted: `.claude/plans/agents-claude-minimal-refresh-plan.md`
  - Deleted: `.claude/plans/analysis-editability-validation-plan-2026-05-04.md`
  - Deleted: `.claude/plans/code-change-workflow-agents-plan.md`
  - Deleted: `.claude/plans/coffee-profile-archive-soft-delete-guard-plan.md`
  - Deleted: `.claude/plans/coffees-id-method-grouping-and-label-casing-plan-2026-05-04.md`
  - Deleted: `.claude/plans/confirmsheet-a11y-followup.md`
  - Deleted: `.claude/plans/data-testid-rollout-plan.md`
  - Deleted: `.claude/plans/duplicate-coffee-profile-validation-plan.md`
  - Deleted: `.claude/plans/grind-logic-parity-plan.md`
  - Deleted: `.claude/plans/mobile-modernization-plan-2026-05-03.md`
  - Deleted: `.claude/plans/navigation-performance-followup.md`
  - Deleted: `.claude/plans/recipe-bulk-delete-plan.md`
  - Deleted: `.claude/plans/recipes-screen-favorites-shared-pagination-plan.md`
  - Deleted: `.claude/plans/recipes-tabs-single-row-ux-plan.md`
  - Deleted: `.claude/plans/save-profile-without-generation-plan.md`
  - Deleted: `.claude/plans/saved-coffee-profiles-implementation-plan.md`
  - Deleted: `.claude/plans/skill-parity-roadmap-checklist.md`
  - Untracked: `.claude/plans/performance-review-optimization-plan.md`
  - Untracked: `CONTEXT.md`
- [x] Task-owned files for this request:
  - `.claude/plans/ui-navigation-performance-debug-plan-2026-05-04.md`

## Step 1: Reproduce and Frame the Lag
- [x] Define 2-3 exact laggy navigation flows (example: `/scan -> /analysis`, `/analysis -> /recipe`, `/recipes -> /recipes/[id]`).
- [x] Record expected vs actual for each flow:
  - Expected: transition starts immediately, interactive UI under ~200ms perceived delay.
  - Actual: likely UI-side lag confirmed by user; benchmarked route load for `/recipes` and `/coffees` as high-impact list/detail navigation surfaces.
- [x] Capture environment used for repro (device profile, browser, throttling, auth state, dataset size).
  - Environment: local dev server (`next dev`) on `http://localhost:3000`, Lighthouse mobile defaults, cold-load route audits, unknown auth/data volume.

## Step 2: Establish Performance Baseline (No Code Changes)
- [x] Run Lighthouse for key route(s) in mobile profile and save reports:
  - collect `Performance`, `TBT`, `INP`, `LCP`, `CLS`.
  - run at least 3 times per route and take median.
- [ ] Use Playwright trace for navigation flows to measure:
  - click-to-route-change time,
  - click-to-interactive time,
  - long-task windows during transition.
- [x] Capture bundle/client JS cost indicators (Next build output, route JS weight, dynamic chunks used by target screens).
  - Build completed successfully (`npm run build`) and app-route map captured.
  - Note: precise per-route JS weight requires additional analyzer output.

## Step 3: Localize Client-Side Bottlenecks
- [ ] Profile React render during each laggy flow (React Profiler + Chrome Performance panel):
  - identify components with highest render/commit cost.
- [x] Inspect transition-heavy client screens first:
  - `src/app/analysis/page.tsx`
  - `src/app/recipes/RecipesClient.tsx`
  - nav guard/nav components in `src/components/NavGuardContext.tsx`, `src/components/SideNav.tsx`, `src/components/BottomNav.tsx`
- [x] Determine which bottleneck class dominates per flow:
  - excessive re-renders,
  - large synchronous work in event handlers/effects,
  - hydration cost,
  - avoidable `router.refresh()` invalidations,
  - expensive list rendering.
  - Finding: `/analysis -> /recipe` lag is primarily wait time on `POST /api/recipes/from-profile` (~7.96s), not local route transition.

## Step 4: Add Automated Regression Signal
- [ ] Add a focused Playwright performance check (or repeatable script) that fails when nav latency exceeds agreed threshold.
- [ ] Store artifacts (trace + metric summary JSON) for before/after comparisons.
- [ ] If strict pass/fail is flaky, define stable guardrails (p95 threshold + tolerance band).

## Step 5: Fix Strategy (Prioritized)
- [ ] Priority A: Reduce transition blocking work.
  - Move non-critical sync work out of critical click/navigation path.
  - Gate expensive computations to only affected views/states.
- [ ] Priority B: Reduce re-renders.
  - Stabilize props and callbacks where profiler proves churn.
  - Split heavy client sections into smaller memoized boundaries.
- [ ] Priority C: Reduce shipped/hydrated JS for laggy routes.
  - defer heavy non-critical UI via `next/dynamic` where appropriate.
  - avoid loading optional features before user intent.
- [ ] Priority D: Reduce forced data invalidation on nav.
  - audit `router.refresh()` usage in client flows; keep only where data correctness requires immediate revalidation.

## Step 6: Validate Improvements
- [ ] Re-run Lighthouse and Playwright baseline suite on same environment.
- [ ] Compare median deltas for TBT/INP and click-to-interactive per flow.
- [ ] Confirm no UX regressions (guard dialogs, selection mode, archived/shared filters, unsaved state protections).

## Step 7: Rollout and Guardrails
- [ ] Document measured wins and residual risks.
- [ ] Keep automated perf check in CI (informational first, then enforced threshold once stable).
- [ ] If unresolved lag remains, run second profiling pass focused on the worst single flow only.

## Working Hypotheses to Validate First
- [x] Heavy client work in `analysis/page.tsx` during state initialization is causing commit delays.
- [x] `RecipesClient` URL/state sync and list UI updates may trigger avoidable re-renders during navigation/filter changes.
- [x] Navigation guard state updates can add extra render churn when leaving guarded screens.

## Evidence Snapshot (2026-05-04)
- [x] Lighthouse artifacts saved in `.claude/artifacts/perf/`:
  - `lh-recipes-1..3.json`
  - `lh-coffees-1..3.json`
- [x] Median metrics from 3 runs:
  - `/recipes`: Performance `73`, TBT `124ms`, LCP `~7.96s`, FCP `~2.11s`, TTI `~7.96s`, CLS `0`.
  - `/coffees`: Performance `79`, TBT `77ms`, LCP `~5.76s`, FCP `~1.06s`, TTI `~6.93s`, CLS `0`.
- [x] Tooling blocker logged:
  - Chrome DevTools MCP could not attach (`Could not find DevToolsActivePort`), so Playwright/trace step is pending environment setup.
- [x] Authenticated Playwright traces added:
  - `/scan -> /analysis`: ~139ms
  - `/recipes -> /recipes/[id]`: ~59ms
  - `/analysis -> /recipe`: ~6.85s to ~8.94s total
- [x] Network timing breakdown captured:
  - `/analysis -> /recipe` split:
    - analysis -> methods: ~620ms
    - methods continue -> recipe: ~8012ms
  - Dominant request: `POST /api/recipes/from-profile` ~7957ms

## Execution Notes
- [ ] Start with measurement only; no production logic changes until bottlenecks are evidenced.
- [ ] Optimize one high-impact flow at a time to avoid broad, low-confidence refactors.
