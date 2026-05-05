# Performance Review and Optimization Plan

- [ ] Record baseline metadata
  - Pre-existing dirty files: `CONTEXT.md` modified during grilling session (domain decisions captured)
  - Task-owned files (planning stage):
    - `CONTEXT.md`
    - `.claude/plans/performance-review-optimization-plan.md`

- [ ] Confirm scope and non-goals
  - Primary objective: improve backend response latency for recipe list read paths
  - In-scope APIs: read/list paths only (`GET /api/recipes` and list-query dependencies)
  - Out of scope in Phase 1: write/mutation routes (unless directly blocking list latency), middleware optimization
  - Keep API request/response contracts unchanged

- [ ] Define Phase 1 performance targets and measurement rules
  - Target: p95 <= 300ms per section (`my`, `shared`, `favorites`), not global-only
  - Representative load profile:
    - 200-500 total recipes (owned + shared)
    - 20-40 favorites
    - mixed `section` / `method` / `q` / `page` usage
  - Decision source: production APM p95 authoritative; controlled load tests are supporting evidence only
  - Comparison method: matched 7-day pre/post windows with same weekday mix, excluding incidents/outages

- [ ] Lock parity constraints (must remain unchanged)
  - Preserve ordering semantics exactly (favorites priority + current `created_at` tie behavior)
  - Preserve `q` matching semantics (`ilike`-style partial/case-insensitive + current escaping behavior)
  - Preserve page normalization behavior for out-of-range pages
  - Preserve schema-resilience fallback behavior (optional table/schema variance handling)
  - Preserve exact `totalCount` and `totalPages` behavior (no approximations in Phase 1)

- [ ] Define rollout architecture and safety controls
  - Use one feature-flagged optimized code path with progressive enablement by section
  - Section optimization order:
    1. `my`
    2. `shared`
    3. `favorites`
  - Section completion gate: each section must pass parity + latency gates before moving to next section
  - Rollout ladder per section: `5% -> 25% -> 50% -> 100%`
  - Minimum observation time: 24 hours per stage

- [ ] Define parity validation gates
  - Run sampled shadow dual-read comparisons (legacy vs optimized) before/while rollout
  - Full rollout requires zero semantic diffs in:
    - returned recipe IDs
    - ordering
    - filter outcomes
  - Non-semantic serialization diffs allowed only if explicitly whitelisted

- [ ] Define latency gating and fallback triggers
  - Minimum sample size: >= 1,000 requests per section per stage
  - Under-sampled stage policy: extend stage; do not promote until threshold is met
  - Regression fallback trigger: section p95 >= 10% worse than matched baseline (after sample threshold met)
  - Fallback triggers include either:
    - latency regression trigger, or
    - any confirmed semantic parity mismatch
  - Rollback scope: section-scoped rollback only (keep passing sections enabled)
  - Emergency control: on-call may force immediate rollback when trigger conditions are met

- [ ] Implement Batch 1 (after approval)
  - Refactor `src/lib/recipe-list.ts` for database-driven pagination/sorting/filtering where possible
  - Use approved two-step retrieval (ordered IDs then hydration) where needed to preserve semantics
  - Add internal payload trimming where safe (no response contract changes)
  - Preserve behavior for `my`, `shared`, `favorites` sections exactly

- [ ] Apply index strategy (if required)
  - Allow incremental, section-specific index additions
  - Enforce online-safe/backward-compatible migrations only
  - Prepare rollback path for each index change
  - Documentation default: migration/changelog
  - ADR only when hard-to-reverse + surprising + trade-off-driven

- [ ] Verification and quality gates
  - For each section:
    - existing automated tests pass
    - parity-focused tests pass for IDs/order/filters/`totalCount`/`totalPages`
  - Telemetry dimensions (minimum):
    - `section`
    - `has_q`
    - `has_method`
    - `page_bucket`

- [ ] Post-Phase-1 decision gate
  - Compare pre/post p95 by section using matched windows
  - Only consider middleware optimization if:
    - any section p95 remains > 300ms, or
    - total improvement is < 20%

- [ ] Release hygiene (when code changes are implemented)
  - Bump `package.json` version (PATCH unless scope dictates otherwise)
  - Add user-facing performance notes in `CHANGELOG.md`

- [ ] Review and handoff
  - Run findings-first review immediately after implementation
  - If clean, ask for commit-readiness confirmation
  - After commit-readiness confirmation, run:
    - `npm test`
    - `npm run lint`
    - `npm run build`
  - Provide at least one concise recommended commit message
