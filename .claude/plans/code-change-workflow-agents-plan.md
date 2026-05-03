# Add Code-Change Workflow Section to `AGENTS.md`

## Summary
- Add a new `## Code Change Workflow` section to `AGENTS.md` that codifies your 5-step flow for all code-change requests.
- Keep wording short, imperative, and unambiguous.
- Preserve existing compact style and avoid duplicating rules already covered in other sections.
- Make workflow deterministic with explicit scope, approval cadence, review/test fallback actions, and rework loops.

## Key Changes
- [ ] Insert `## Code Change Workflow` immediately after `## Plan Output Requirement` in `AGENTS.md`.
- [ ] Add explicit trigger scope:
  - Applies whenever a user requests code changes, including app/runtime code, tests, configs, scripts, and dependency-impacting edits.
  - Excludes pure docs-only changes unless user explicitly asks to run this workflow.
- [ ] Add Step 1 rule exactly in spirit:
  - Always provide a detailed implementation plan first (prefer simplest/least-complex viable path).
  - Wait for explicit user confirmation before implementing, even when not in plan mode.
  - Plan persistence rule: store each code-change plan as checklist markdown in `.claude/plans/` before implementation begins.
  - Before implementation, record dirty-tree baseline in the plan file:
    - list of pre-existing changed files,
    - explicit list of task-owned files to be edited.
- [ ] Add Step 2 rule:
  - After approval, implement.
  - Keep the written plan updated by marking completed items.
- [ ] Add Step 3 rule:
  - Immediately after implementation, run `review-recent-changes` review.
  - Preferred: spawn `review-recent-changes` skill/agent when available.
  - Fallback: perform manual findings-first review with deterministic scope:
    - if branch is clean at task start: review full working-tree diff,
    - if branch is dirty at task start and task-owned files were clean at baseline: review only task-owned file diffs,
    - if branch is dirty at task start and a task-owned file was already dirty at baseline: review full current diff for that file and explicitly label mixed provenance (cannot isolate pre-existing vs task hunks reliably).
  - Wait for and report review feedback before moving forward.
- [ ] Add Step 4 rule:
  - If no issues are found, ask whether the user wants to proceed to commit readiness validation.
  - Optional user manual testing can happen before this validation; if user reports new issues, re-enter Step 2 (approval before fixes), then Step 3 review.
- [ ] Add Step 5 rule:
  - Validation is triggered only after user confirms readiness to commit.
  - Preferred: use `test-runner` role if available in the current session tooling.
  - Fallback minimum validation command: `npm test`.
  - Additional validation gate for this repo: run `npm run lint` and `npm run build` before final commit recommendation.
  - If validation passes and no blocking issues remain, provide at least one recommended commit message.
- [ ] Add issue-handling branch (resolved preference):
  - If review detects issues, present findings and wait for user approval before applying additional fixes.
  - Follow-up fixes require updating the written plan checklist and fresh explicit user approval before each new fix batch.
  - Before each newly approved fix batch, refresh workflow metadata if changed:
    - update task-owned file list when scope expands,
    - note any newly observed ambient dirty files.
  - Apply release hygiene in Step 2 before Step 3 review:
    - update `package.json` SemVer when required,
    - update `CHANGELOG.md` when applicable.
  - After approved fixes are applied, rerun Step 2 release hygiene check, then rerun Step 3 review.
  - Validation is not rerun automatically; it only runs at Step 5 after user confirms commit readiness.
  - If Step 5 validation fails, report failures with concise causes, request approval for fixes, apply fixes, then return to Step 3 review before asking commit readiness again.

## Public Interfaces / Behavior Changes
- [ ] Behavioral policy change for agents:
  - For agents following this repo’s `AGENTS.md`, “implement immediately” is overridden by mandatory plan+approval gate for code-change requests.
- [ ] No runtime/app code changes; docs-only policy update.

## Validation Checklist
- [ ] Confirm no contradiction with existing sections:
  - Keep SemVer/changelog/commit-message requirements in `Change Hygiene` and `Handoff Requirements`.
  - Avoid duplicating technical invariants from `Repo Invariants`.
- [ ] Confirm workflow is deterministic:
  - clear start condition, clear approval gate, clear post-implementation review gate, clear pre-commit test gate.
  - clear fallback actions when reviewer/test-runner agents are unavailable.
  - clear rework loop after review findings or failing validation.
  - clear dirty-tree behavior when pre-existing edits overlap task-owned files.
- [ ] Keep section concise (single-level bullets, no long prose).

## Assumptions
- [ ] The new workflow is intended to be mandatory for all code-change requests, regardless of change size.
- [ ] For review findings, default action is “report and wait for approval,” not auto-fix.
- [ ] Non-goal: force this workflow for docs-only edits by default.
- [ ] `test-runner` availability rule: considered available only when the role is exposed in current session tooling; otherwise use command fallback.
