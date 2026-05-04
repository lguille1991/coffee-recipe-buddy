# Coffees [id] Method Grouping + Label Casing Plan (2026-05-04)

## Baseline metadata
- Pre-existing dirty files: none (`git status --short` clean at planning time)
- Task-owned files:
  - `src/app/coffees/[id]/SavedCoffeeDetailClient.tsx`
  - `src/app/coffees/[id]/SavedCoffeeDetailClient.test.tsx` (new test coverage)
  - `package.json` (required patch SemVer bump per repo policy)
  - `CHANGELOG.md` (user-facing update)

## Workflow gates (AGENTS compliance)
- [ ] Implementation approval gate: wait for explicit user approval before writing code.
- [ ] Post-implementation review gate: run `review-recent-changes` (or deterministic manual fallback) and report findings first.
- [ ] Commit-readiness checkpoint: if no review issues, ask user whether to proceed to commit-readiness validation.
- [ ] Validation gate after user confirmation: run `npm test`, `npm run lint`, and `npm run build`.
- [ ] If validation passes, provide at least one concise suggested commit message.

## Implementation checklist
- [ ] Add a display-only formatter utility in `SavedCoffeeDetailClient.tsx` that:
  - replaces `_` and `-` with spaces,
  - title-cases each token,
  - keeps raw values unchanged in component state and API payloads.
- [ ] Build `BeanProfile`-compatible recommendation input from available `detail.profile.bean_profile_json` fields (reduced-input path accepted), then compute recommendations with `recommendMethods(..., { brewGoal: goal })`.
- [ ] Build grouped method options:
  - `Recommended methods` = top 3 ranked recommendations in returned order.
  - `Other` = remaining methods in existing schema order, excluding duplicates.
- [ ] Update `data-testid="brew-method"` select to render optgroup headers for `Recommended methods` and `Other`.
- [ ] Default `method` to the top recommended method exactly once after initial profile hydration, and never override user choice afterward.
- [ ] Recompute recommendation grouping when `goal` changes while preserving current selected `method` unless the user explicitly changes it.
- [ ] Apply UI-only capitalization updates:
  - `data-testid="bean-process"` display text uses formatter for process and roast-level labels.
  - `data-testid="brew-goal"` option labels use formatter output while keeping option `value` unchanged.
- [ ] Add/extend tests in `SavedCoffeeDetailClient.test.tsx` to cover:
  - grouped `brew-method` optgroups and ordering,
  - one-time default to top recommendation,
  - no method override after user selection and subsequent goal change,
  - unchanged payload values,
  - UI-only formatted labels for bean process/roast and brew-goal.

## Release hygiene checklist
- [ ] Patch bump `package.json` version.
- [ ] Append user-facing update to `CHANGELOG.md`.

## Post-implementation review checklist
- [ ] Run immediate findings-first review over task-owned diffs.
- [ ] Report findings and wait for approval before any additional fixes.
