# Fellow Opus Follow-Up Findings Plan

## Goal

- Remove the fragile session-storage migration shortcut introduced for `fellow_opus`.
- Add focused regression coverage for the highest-risk Fellow Opus conversion and migration paths before commit-readiness validation.

## Baseline metadata

- Pre-existing dirty files:
  - `docs/grinder-tables/fellow-opus-grind-table.md`
  - `.claude/plans/fellow-opus-grind-table-plan-2026-05-27.md`
- Task-owned files:
  - `.claude/plans/fellow-opus-follow-up-findings-plan-2026-05-27.md`
  - `src/lib/recipe-session-storage.ts`
  - `src/lib/__tests__/grinder-converter.test.ts`
  - `src/lib/__tests__/recipe-migrations.test.ts`
  - `src/lib/__tests__/recipe-session-storage.test.ts`
- Release hygiene note:
  - This is app/runtime behavior plus regression-test work, so reassess whether `package.json` / `CHANGELOG.md` need updates if production behavior changes beyond internal safety fixes.

## Findings being addressed

- [ ] Fix the session-storage migration gate in `src/lib/recipe-session-storage.ts`.
  - Current issue:
    - Migration is skipped solely when `recipe.grind.fellow_opus` exists.
    - That prevents any future recipe migration from running on restored session/local-storage payloads once Opus is present.
  - Preferred fix direction:
    - Persist schema-version metadata alongside stored recipe payloads and migrate based on version.
  - Acceptable smaller fallback:
    - Scope the current shortcut only to the specific `v5 -> v6` Opus backfill instead of using it as the general migration exit condition.
  - Guardrails:
    - Keep existing recovery behavior for current users.
    - Avoid mutating already-current payloads unnecessarily.
    - Preserve compatibility for both `recipe` and `recipeOriginal`, plus pending save payloads if touched.

- [ ] Add focused Fellow Opus regression coverage.
  - `src/lib/__tests__/grinder-converter.test.ts`
    - Add explicit quarter-step validation assertions for valid and invalid Opus inputs.
    - Add K-Ultra -> Opus -> K-Ultra round-trip expectations with acceptable tolerance.
    - Add Opus display/edit formatting assertions.
    - Add Opus range parsing and formatting assertions.
  - `src/lib/__tests__/recipe-migrations.test.ts`
    - Add an explicit `v5 -> v6` migration test that derives `fellow_opus`.
    - Add a full-chain migration assertion ending with all five grinders present.
  - `src/lib/__tests__/recipe-session-storage.test.ts`
    - Add restore-path coverage proving legacy stored recipes are migrated correctly.
    - If schema-version metadata is introduced, add coverage for current-version payloads remaining stable and older payloads upgrading as expected.
  - If implementation touches share-specific migration helpers:
    - Add or extend legacy share/session migration path tests in the appropriate test files before commit-readiness validation.

## Validation target

- [ ] Run focused tests for the touched files first.
  - `npm test -- src/lib/__tests__/grinder-converter.test.ts src/lib/__tests__/recipe-migrations.test.ts src/lib/__tests__/recipe-session-storage.test.ts`
- [ ] Run full suite after the focused regression pass.
  - `npm test`

## Success criteria

- Session/local-storage recipe recovery no longer blocks future migrations just because `fellow_opus` exists.
- Opus conversion and migration behavior is covered by explicit regression tests rather than inferred through broader suite pass/fail.
- Legacy restored payloads and current-version payloads both behave predictably under the chosen migration strategy.
