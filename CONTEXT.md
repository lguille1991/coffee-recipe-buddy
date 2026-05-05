# Coffee Recipe Buddy

Domain language for generating, saving, sharing, and retrieving coffee brewing recipes with predictable performance characteristics.

## Language

**Recipe List Endpoint**:
The authenticated API path family used to query paginated recipe collections for a user.
_Avoid_: recipes API, list API

**Behavioral Parity**:
A guarantee that optimization changes do not alter what recipes a user can see or how filters/pagination/favorites behave.
_Avoid_: same output, no regressions

**Ordering Semantics**:
The existing recipe ordering contract where favorites are prioritized per section and remaining ties follow current `created_at` behavior.
_Avoid_: default sort, roughly same order

**Backend Response Latency Target**:
The p95 response-time SLO for recipe list endpoints under typical authenticated production usage.
_Avoid_: speed goal, faster API

**Phase 1 Representative Load Profile**:
Authenticated users with 200-500 total recipes (owned and shared), 20-40 favorites, and mixed `section`/`method`/`q`/`page` filters.
_Avoid_: average user, normal load

**Read-Path Index Policy**:
Phase 1 may introduce backward-compatible indexes for recipe list read paths when required to achieve latency targets.
_Avoid_: query-only optimization, schema freeze

**API Contract Stability**:
Phase 1 optimizations must keep existing list API request parameters and response shapes unchanged.
_Avoid_: minor contract tweaks, response cleanup

**Two-Step List Retrieval**:
List endpoints may fetch ordered recipe identifiers first and then hydrate recipe details in a second step when needed to preserve ordering and reduce latency.
_Avoid_: single-query purity, one-shot fetch

**Middleware Deferral Rule**:
Middleware/session-refresh optimization is postponed until recipe-list query optimizations are implemented and measured.
_Avoid_: optimize everything at once, parallel middleware refactor

**Middleware Escalation Gate**:
Middleware optimization starts only if post-Phase-1 p95 remains above 300ms or p95 improvement is less than 20% against baseline.
_Avoid_: immediate middleware tuning, subjective "not fast enough"

**Latency Decision Source**:
Production APM p95 is authoritative for optimization decisions, with controlled load tests used only as supporting evidence when production data is noisy.
_Avoid_: synthetic-only truth, anecdotal speed checks

**Matched Measurement Window**:
Pre/post latency comparisons use matched 7-day windows with the same weekday mix and exclude incident/outage periods.
_Avoid_: same-day snapshots, unfiltered weekly averages

**List Query Rollout Flag**:
Phase 1 query-path optimizations ship behind a server-side feature flag with immediate fallback to the legacy path.
_Avoid_: big-bang rollout, no-escape deployment

**Fallback Trigger Policy**:
Rollback to the legacy list query path is triggered by either a statistically significant p95 latency regression or any confirmed behavioral parity mismatch.
_Avoid_: latency-only rollback, manual-only rollback

**Shadow Parity Validation**:
Before full enablement, a sampled subset of requests runs both legacy and optimized list query paths and records response diffs.
_Avoid_: trust-by-tests-only, no-runtime comparison

**Semantic Diff Gate**:
Full rollout requires zero semantic diffs in recipe IDs, ordering, and filter outcomes, while explicitly whitelisted non-semantic serialization diffs are allowed.
_Avoid_: best-effort parity, visual-only comparisons

**Online Index Migration Rule**:
Any Phase 1 index change must use online-safe, backward-compatible migration patterns with a prepared rollback path.
_Avoid_: blocking index rebuilds, irreversible schema edits

**Section-Level Latency SLO**:
Latency is measured per list section (`my`, `shared`, `favorites`) with global aggregate metrics treated as secondary context.
_Avoid_: single blended p95, aggregate-only gate

**Per-Section Hard Target**:
Each list section must independently meet the 300ms p95 target and may not be excused by global aggregate performance.
_Avoid_: weighted pass, global-only compliance

**Search Semantics Freeze**:
Phase 1 must preserve current section-specific search behavior exactly, even if interim implementations retain some in-memory filtering.
_Avoid_: opportunistic search cleanup, semantic tightening

**Exact Pagination Metadata**:
Phase 1 must return exact `totalCount` and `totalPages` values for list endpoints.
_Avoid_: approximate counts, estimated pagination

**Exactness Escalation Rule**:
If exact pagination metadata becomes the dominant latency blocker, Phase 1 does not relax exactness and instead escalates to a new design phase.
_Avoid_: silent scope creep, temporary approximation

**Minimum Rollout Telemetry Dimensions**:
Phase 1 telemetry must be tagged by `section`, `has_q`, `has_method`, and `page_bucket` at minimum.
_Avoid_: opaque aggregate metrics, unsegmented traces

**Rollout Ladder**:
After shadow validation passes, rollout progresses 5% -> 25% -> 50% -> 100% with at least 24 hours of observation and gate checks at each stage.
_Avoid_: instant 100%, ad hoc rollout jumps

**Emergency Rollback Authority**:
On-call engineers may immediately force rollback when fallback trigger conditions are met, followed by post-incident review.
_Avoid_: approval bottlenecks during incidents, delayed rollback

**Rollout Sign-Off Rule**:
Progression to full rollout requires engineering-only sign-off when all latency/parity gates pass and no incident flags are open.
_Avoid_: implicit promotion, cross-team blocking sign-off

**Section Optimization Sequence**:
Phase 1 implementation order is `my` first, then `shared`, then `favorites`, using one feature-flagged code path that can be enabled progressively per section.
_Avoid_: all-sections big bang, independent uncoordinated rewrites

**Section Completion Gate**:
Each section must pass semantic parity and per-section latency targets before optimization work advances to the next section.
_Avoid_: parallel unfinished sections, partial gate acceptance

**Incremental Index Strategy**:
Indexes may be introduced incrementally per section as needed, as long as each change is backward-compatible and documented.
_Avoid_: upfront index mega-plan, undocumented tuning

**Index Documentation Threshold**:
Index changes are documented in migrations and changelog by default, with ADRs reserved for hard-to-reverse, surprising, trade-off-driven decisions.
_Avoid_: ADR for every index, undocumented rationale

**Query Matching Freeze**:
Phase 1 must preserve current case-insensitive partial `q` matching and escaping semantics rather than introducing full-text behavior changes.
_Avoid_: relevance tuning, tokenizer-driven search changes

**Page Normalization Parity**:
Out-of-range page inputs must retain current normalization behavior to the nearest valid page boundary.
_Avoid_: strict invalid-page errors, empty-page fallback changes

**Schema Resilience Parity**:
Phase 1 must preserve existing fallback behavior for missing optional tables or schema variants in list-related flows.
_Avoid_: cleanup-by-removal, strict-schema-only assumptions

**Authenticated Cache Semantics Freeze**:
Phase 1 keeps current private/no-store caching semantics for authenticated list APIs unchanged.
_Avoid_: cache-policy experiments, CDN-based fixes

**Internal Payload Trimming Allowance**:
Phase 1 may reduce internally selected/transferred data when API response contracts remain unchanged.
_Avoid_: payload bloat by inertia, contract-changing field removal

**Section Verification Requirement**:
Each section promotion requires existing automated test pass plus dedicated parity tests for recipe IDs, ordering, filters, `totalCount`, and `totalPages`.
_Avoid_: latency-only validation, smoke-test-only gating

**Minimum Latency Sample Gate**:
Section-level latency gate decisions require a minimum request sample size per rollout stage before p95 is considered reliable.
_Avoid_: low-volume p95 decisions, noisy-stage promotion

**Latency Sample Threshold**:
Each section requires at least 1,000 requests per rollout stage for p95 gate decisions.
_Avoid_: ad hoc sample adequacy, tiny-window acceptance

**Under-Sampled Stage Policy**:
If a section has fewer than 1,000 requests in a stage window, the stage is extended and promotion is blocked until the threshold is met.
_Avoid_: deadline-driven promotion, underpowered decisions

**Latency Regression Trigger**:
Fallback is triggered when a section’s p95 latency is at least 10% higher than its matched baseline after minimum sample thresholds are met.
_Avoid_: vague regression calls, moving-goalpost rollback

## Relationships

- A **Recipe List Endpoint** must satisfy **Behavioral Parity** during optimization work
- A **Backend Response Latency Target** constrains optimization choices for each **Recipe List Endpoint**
- The **Backend Response Latency Target** is evaluated against the **Phase 1 Representative Load Profile**
- **Ordering Semantics** are a non-negotiable part of **Behavioral Parity**
- The **Read-Path Index Policy** is an allowed lever for meeting the **Backend Response Latency Target**
- **API Contract Stability** constrains all Phase 1 changes to internal behavior only
- **Two-Step List Retrieval** is an approved implementation pattern under **API Contract Stability**
- The **Middleware Deferral Rule** keeps Phase 1 scope limited to recipe-list query paths
- The **Middleware Escalation Gate** determines whether work proceeds beyond query-path optimization
- The **Latency Decision Source** governs pass/fail evaluation for the **Middleware Escalation Gate**
- The **Matched Measurement Window** defines how the **Latency Decision Source** is compared pre/post
- The **List Query Rollout Flag** protects **Behavioral Parity** during production rollout
- The **Fallback Trigger Policy** governs when the **List Query Rollout Flag** reverts to legacy behavior
- **Shadow Parity Validation** provides production evidence for **Behavioral Parity** before full rollout
- The **Semantic Diff Gate** defines pass/fail criteria for **Shadow Parity Validation**
- The **Online Index Migration Rule** constrains how the **Read-Path Index Policy** is executed
- The **Section-Level Latency SLO** controls rollout decisions under the **Latency Decision Source**
- The **Per-Section Hard Target** defines pass/fail criteria for the **Section-Level Latency SLO**
- The **Search Semantics Freeze** is a mandatory constraint under **Behavioral Parity**
- **Exact Pagination Metadata** is part of **Behavioral Parity** for list responses
- The **Exactness Escalation Rule** governs failures where **Exact Pagination Metadata** threatens the latency target
- The **Minimum Rollout Telemetry Dimensions** enable section/filter diagnosis for the **Latency Decision Source**
- The **Rollout Ladder** operationalizes the **List Query Rollout Flag** with staged risk control
- The **Emergency Rollback Authority** executes the **Fallback Trigger Policy** during live incidents
- The **Rollout Sign-Off Rule** governs promotion from staged rollout to 100% enablement
- The **Section Optimization Sequence** determines rollout and validation order under the **Per-Section Hard Target**
- The **Section Completion Gate** enforces quality thresholds within the **Section Optimization Sequence**
- The **Incremental Index Strategy** operationalizes the **Read-Path Index Policy** during section-by-section rollout
- The **Index Documentation Threshold** determines when **Incremental Index Strategy** requires ADR-level documentation
- The **Query Matching Freeze** is a mandatory constraint under **Search Semantics Freeze**
- **Page Normalization Parity** is part of **Exact Pagination Metadata** behavior
- **Schema Resilience Parity** is part of **Behavioral Parity** for heterogeneous deployments
- **Authenticated Cache Semantics Freeze** constrains Phase 1 to query-path execution optimizations
- **Internal Payload Trimming Allowance** is permitted under **API Contract Stability**
- The **Section Verification Requirement** is enforced by the **Section Completion Gate**
- The **Minimum Latency Sample Gate** qualifies the **Section-Level Latency SLO** for rollout decisions
- The **Latency Sample Threshold** quantifies the **Minimum Latency Sample Gate**
- The **Under-Sampled Stage Policy** enforces the **Latency Sample Threshold** during staged rollout
- The **Latency Regression Trigger** is one branch of the **Fallback Trigger Policy**

## Example dialogue

> **Dev:** "Can we skip shared recipes to hit the latency target?"
> **Domain expert:** "No, keep **Behavioral Parity** and optimize query shape so the **Recipe List Endpoint** still returns the same visible recipes."

## Flagged ambiguities

- "related APIs" resolved to read/list paths only (`GET /api/recipes` and list-query dependencies such as section/filter/favorites/shared retrieval); write/mutation routes are out of Phase 1 scope unless they block read/list latency.
