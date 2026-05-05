# Analysis-to-Recipe Latency Fix Plan (2026-05-04)

## Baseline Metadata
- [x] Pre-existing dirty files recorded from `git status --short` baseline (existing `.claude/plans/*` deletions + untracked plan/context files).
- [x] Task-owned files for this plan request:
  - `.claude/plans/analysis-to-recipe-latency-fix-plan-2026-05-04.md`

## Problem Statement
- [x] Confirmed slow flow: `/analysis -> /recipe`.
- [x] Measured dominant bottleneck:
  - `POST /api/recipes/from-profile` ~= `7.9s` (majority of `~8.0s` methods->recipe segment).
- [x] Fast control flows for comparison:
  - `/scan -> /analysis` ~= `139ms`
  - `/recipes -> /recipes/[id]` ~= `59ms`

## Goal
- [x] Reduce perceived latency and uncertainty during recipe generation.
- [x] Add guardrails/telemetry so regressions are measurable.
- [x] Preserve current behavior and data correctness.

## Step 1: UX During Long Generation Wait
- [x] Update [`src/app/methods/page.tsx`](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/methods/page.tsx) to present an immediate blocking progress state after user clicks `Continue`.
- [x] Replace passive spinner-only behavior with explicit loading copy tied only to observable client states (for example: `request started`, `still processing`, `completed`), not unverified backend milestones.
- [x] Keep selection controls disabled while request is in flight to prevent duplicate submissions.
- [x] Ensure accessibility: status region with `aria-live="polite"` and clear button disabled states.
- [x] Define in-flight navigation policy and implement it:
  - either block back/route exits while generating,
  - or allow exit but ignore late async completion so stale responses cannot redirect users.

## Step 2: Timeout and Recovery UX
- [x] Apply in-flight, timeout, and recovery behavior consistently to both generation branches in methods flow:
  - `/api/recipes/from-profile`
  - `/api/generate-recipe`
- [x] Add client timeout wrapper (AbortController-based) for generation requests.
- [x] Define timeout semantics as `outcome unknown` unless server returns a confirmed error.
- [x] Add late-success reconciliation strategy for timed-out requests (client abort does not guarantee server cancellation):
  - avoid guaranteed-failure copy,
  - provide path to recover/open potentially created recipe when feasible.
- [x] On timeout/network failure, show explicit recovery choices:
  - retry generation,
  - return to method selection without losing selected method.
- [x] Preserve current duplicate-profile handling path and avoid changing auth/profile invariants.

## Step 3: Lightweight Client Telemetry
- [x] Add client performance marks in methods flow:
  - `continue_click`,
  - `api_generation_start`,
  - `api_generation_end`,
  - `route_arrival_recipe`.
- [x] Record success/timeout/error durations through a production-safe metric/event path (with dev console logs as optional secondary debugging output).
- [x] Keep instrumentation local to methods flow and non-invasive.

## Step 4: Validation
- [ ] Re-run authenticated Playwright trace for `/analysis -> /recipe` using existing scripts in `.claude/artifacts/perf/`.
- [ ] Confirm UX criteria even if raw backend time remains high:
  - immediate feedback <= 100ms after click,
  - no dead/ambiguous waiting period,
  - deterministic error/timeout recovery.
- [ ] Verify no regressions for:
  - duplicate profile confirm flow,
  - save-and-generate path,
  - navigation guard expectations.
- [x] Add automated tests for methods generation state branches:
  - in-flight locked state,
  - timeout unknown-outcome messaging,
  - retry path,
  - fallback `/api/generate-recipe` parity,
  - stale-response behavior after user navigates away.

## Step 5: Release Hygiene and Review
- [x] Bump `package.json` version (PATCH, user-facing UX/perf refinement).
- [x] Add user-facing entry in `CHANGELOG.md` describing generation-wait UX improvements.
- [ ] Run review step (findings-first) on changed files before commit-readiness checkpoint.

## Candidate Task-Owned Files (Implementation Phase)
- [ ] `src/app/methods/page.tsx`
- [ ] `src/app/methods/page.test.tsx` (or nearest existing methods test file)
- [ ] `package.json` (PATCH bump)
- [ ] `CHANGELOG.md`
- [ ] Optional: `.claude/artifacts/perf/*` updated measurement JSON summaries

## Risks and Mitigations
- [ ] Risk: timeout too aggressive for legitimate long generations.
  - Mitigation: conservative timeout threshold and clear retry path.
- [ ] Risk: timeout treated as hard failure while server still succeeds.
  - Mitigation: explicit unknown-outcome semantics and late-success reconciliation path.
- [ ] Risk: loading UI blocks useful user actions unexpectedly or causes stale redirect race.
  - Mitigation: explicit in-flight navigation policy and stale-completion guard.
- [ ] Risk: instrumentation adds noise.
  - Mitigation: scoped production-safe events and optional dev-only console logs.
