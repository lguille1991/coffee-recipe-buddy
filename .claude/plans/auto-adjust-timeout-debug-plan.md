# Auto-adjust 504 timeout debug + fix plan

- [x] Capture production evidence and reproduction signal
  - Vercel request `dwhtj-1777988239550-4c7f60379cb0` at `2026-05-05T13:37:19.550Z` returned `504 FUNCTION_INVOCATION_TIMEOUT` after `300387ms`.
  - Route: `POST /api/recipes/[id]/auto-adjust`.
  - External calls show `openrouter.ai/api/v1/chat/completions x6 -> 429/200/timeout (82-60250ms)`.
  - Function timed out at platform cap (`~300001ms`) before route returned.

- [x] Baseline metadata
  - Pre-existing dirty files: none observed from `git status --short` during investigation.
  - Task-owned files (planned):
    - `src/app/api/recipes/[id]/auto-adjust/route.ts`
    - `src/app/api/recipes/[id]/auto-adjust/route.test.ts`
    - `src/app/recipes/[id]/auto-adjust/AutoAdjustClient.tsx`
    - `src/app/recipes/[id]/auto-adjust/AutoAdjustClient.test.tsx` (if missing, create focused test)
    - `package.json` (patch version bump required for runtime behavior change)
    - `CHANGELOG.md` (user-facing fix note)

- [x] Await explicit user approval before implementation
  - Implementation and test/code edits begin only after user approval.

- [x] Define timeout contract and budgets before coding
  - Response contract for timeout exhaustion:
    - Route returns `503` with body `{ error: 'Auto-adjust timed out', code: 'AUTO_ADJUST_TIMEOUT', retryable: true }`.
  - Budget ordering and values:
    - Per-attempt OpenRouter call timeout: `25_000ms`.
    - Total route LLM budget (all attempts + fallback): `110_000ms`.
    - Client abort timeout: `120_000ms`.
  - Fallback guard:
    - Do not start another model attempt when remaining total budget is insufficient for a full attempt.

- [x] Add failing automated coverage for timeout behavior
  - Route-level test:
    - Simulate never-resolving OpenRouter completion and assert the handler returns `503` timeout contract instead of hanging.
    - Use fake timers and/or a mockable timeout helper to keep test deterministic and fast.
  - Client-level test:
    - Simulate stalled fetch and assert UI exits loading state with timeout error message.
    - Use fake timers to avoid wall-clock waits.

- [x] Implement server-side bounded runtime for LLM calls
  - Add per-attempt hard timeout guard around `client.chat.completions.create(...)` in `runModelAdjustment`.
  - Convert timeout to deterministic `ModelRunResult` timeout failure.
  - Add global budget guard for route (stop retry loop early when budget exhausted) so total handler time remains well under Vercel max.
  - Keep existing model fallback logic, but cap total attempts/time.
  - Return the defined `503` timeout contract when timeout/budget exhaustion occurs.

- [x] Implement client-side timeout/abort handling
  - Add AbortController timeout wrapper to `handleGenerate` in `AutoAdjustClient.tsx`.
  - Ensure loading spinner always clears and user receives actionable error on timeout.
  - Set client timeout above server budget to avoid premature client abort while server still has planned retry budget.

- [x] Release hygiene
  - Bump `package.json` patch version.
  - Add concise entry to `CHANGELOG.md` describing auto-adjust timeout hardening.

- [ ] Post-implementation review step (before validation)
  - Run findings-first review of changed files (`review-recent-changes` if available, else manual review).
  - Report findings and pause for approval before additional fix iterations.

- [ ] Rework loop (if review finds issues)
  - Update plan checkboxes and refresh metadata:
    - task-owned files,
    - newly observed ambient dirty files.
  - Apply approved fixes only.
  - Re-run release hygiene check if affected.
  - Re-run post-implementation review and report findings again.

- [ ] Commit-readiness checkpoint
  - If review is clean, ask user whether to proceed to commit-readiness validation.
  - Do not run validation gates before explicit user confirmation.

- [ ] Validate behavior and regressions (after commit-readiness confirmation)
  - Run focused tests for updated route and auto-adjust client.
  - Run `npm test`.
  - Run `npm run lint`.
  - Run `npm run build`.
