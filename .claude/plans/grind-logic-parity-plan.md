# Grind Logic Parity Plan (Skill vs App)

## 0) Preconditions
- [x] Read `.agents/docs/REACT_BEST_PRACTICES.md` before code changes.
- [ ] Read relevant Next.js docs under `node_modules/next/dist/docs/` for any route-handler/runtime changes.
- [ ] Decide and record canonical parity source order:
- [x] Decide and record canonical parity source order:
- [x] `docs/coffee-range-system-skill.md` (primary source of truth)
- [x] `coffee-recipe-generator/references/*.md` (secondary/reference-level tie-breakers)
- [x] `src/lib/skill-reference.ts` (implementation mirror; must follow canonical docs)
- [x] Decide whether saved recipes are immutable, re-derived on read, or migrated.
- [x] Decide whether origin-token offsets are part of parity or must be removed.

## 1) Reproduction Status
- [x] Located and compared both logic sources:
- [x] Skill source: `coffee-recipe-generator/SKILL.md` + `coffee-recipe-generator/references/grind-determinants.md` + `coffee-recipe-generator/references/grinder-settings.md`
- [x] App source: `src/lib/skill-grind-engine.ts` + `src/lib/skill-reference.ts` + `src/app/api/generate-recipe/route.ts`
- [x] Confirmed deterministic app override runs after LLM generation (`applySkillGrindSettings`), so current grind output is controlled by app code, not raw model text.

## 2) Evidence Collected (Where Logic Diverges)
- [x] **Base ranges are different (major cause of “coarse” feel).**
- [x] Skill range system uses tight method ranges (e.g., V60 `72–79` in `docs/coffee-range-system-skill.md`).
- [x] App default range for V60 is broad `53–92` (`METHOD_GRIND_BASES.v60` in `src/lib/skill-reference.ts`).
- [x] API only enables strict table parity when `STRICT_GRINDER_TABLE_PARITY=1`; otherwise broad fallback is used (`src/app/api/generate-recipe/route.ts`).
- [x] **Offset model differs from skill references.**
- [x] Skill references describe ranged/stacked offsets with hierarchy + conflict rules.
- [x] App uses single fixed click offsets (`grindProcessOffset`, `grindRoastOffset`, `grindAltitudeOffset`, `grindVarietyOffset`, `grindOriginOffset`).
- [x] **Density alignment rule is missing in app.**
- [x] Skill docs: if altitude and variety point same direction, apply once at midpoint; if conflict, cancel.
- [x] App: simple addition of all offsets (`altitude + variety + origin`), so combined shifts can differ.
- [x] **Profile guardrails are missing in app grind engine.**
- [x] Skill docs Block 11 adds washed/floral high-altitude bias finer + freshness cap behavior.
- [x] App currently has no Block 11 post-processing in `applySkillGrindSettings`.
- [x] **Freshness behavior is directionally aligned but magnitude differs from skill ranges.**
- [x] App uses fixed windows (`+2`, `0`, `-1`, `-2`, `-3`) while skill docs define ranges (often broader at extremes).

## 3) Failing Test Added or Selected
- [x] Existing regression tests confirm current behavior and are useful as baseline:
- [x] `src/lib/__tests__/skill-grind-engine.test.ts` (deterministic chain + freshness + strict parity toggle)
- [x] Add canonical parity fixtures first and make them fail against current behavior before implementation:
- [x] Washed + light/med-light + 1300+ masl floral profile (Block 11 guardrail case)
- [x] Natural + medium-dark + low altitude case (process-priority coarse case)
- [ ] Conflict case: natural + light roast + very fresh (priority ordering check)
- [x] Conflict case: natural + light roast + very fresh (priority ordering check)
- [x] Add at least one fixture per documented precedence/guardrail rule from the chosen canonical source.
- [x] Mark expected-to-change vs invariant assertions:
- [x] Expected-to-change: base ranges, offset interactions, starting-point bias rules.
- [x] Invariant: clamp boundaries, compression width cap behavior, deterministic grinder derivation contract.

## 4) Fix Plan (Exact Replication Path)
- [x] **Phase A — Keep parity behind a rollout gate**
- [x] Keep strict parity behind feature flag until fixtures, historical diffing, and staging comparison pass.
- [ ] Only invert default/remove broad fallback after rollout criteria are met.
- [x] **Phase B — Encode skill decision blocks directly in deterministic grind engine**
- [x] Replace fixed per-field offsets with block-driven resolver (Blocks 2–5, 5B, 10, 11) using explicit precedence.
- [x] Implement density alignment/cancel rule (variety vs altitude) exactly as documented.
- [ ] Implement conflict handling priority: process > freshness > roast > density.
- [x] Implement conflict handling priority: process > freshness > roast > density.
- [x] Implement washed/floral guardrail (Block 11) with explicit criteria and click cap logic.
- [x] Ensure resolver does not mix canonical parity logic with legacy origin-token heuristics unless explicitly decided in Preconditions.
- [x] **Phase C — Add test vectors from skill docs**
- [x] Build table-driven tests from representative profile fixtures and expected K-Ultra ranges/starts.
- [x] Assert both final operating range and starting point midpoint/bias rules.
- [ ] **Phase D — Verify downstream grinder conversions stay deterministic**
- [x] Keep K-Ultra as source of truth; verify Q-Air/Encore/C2 derived values remain in allowed bands.
- [x] Add monotonicity and rounding/step-size checks to prevent conversion regressions when K-Ultra ranges tighten.
- [ ] **Phase E — Operational rollout**
- [ ] Backfill snapshot comparison for previously saved recipes to estimate drift before enabling parity globally.
- [x] Gate with feature flag and compare outputs in staging for same bean payloads (skill vs app).
- [ ] Define acceptable drift thresholds for canonical fixtures and historical recipes.
- [ ] Define rollback trigger and owner if staging/production diffs exceed threshold.

## 5) Open Questions / Blockers
- [x] Which source is canonical when there is inconsistency between:
- [x] `coffee-recipe-generator/references/grind-determinants.md`
- [x] `docs/coffee-range-system-skill.md`
- [x] `src/lib/skill-reference.ts`
- [x] Canonical order locked: `docs/coffee-range-system-skill.md` → `coffee-recipe-generator/references/*.md` → `src/lib/skill-reference.ts`.
- [ ] Do you want strict parity always-on in production now, or behind a rollout flag per user cohort?
- [ ] Should origin token offsets (e.g., Brazil/Ethiopia keyword mapping) remain, or be folded into density-only logic to match the skill framework more strictly?
- [x] Saved recipes policy locked: immutable (no re-derive/migration of existing saved recipe grind fields).

## Reverse-Engineered Current App Logic (for replication)
- [x] Start with method base from `getMethodGrindBase(method, strictParityMode)`.
- [x] Add fixed deltas: process + altitude + roast + variety + origin + freshness.
- [x] Clamp low/high to `40–100` K-Ultra clicks.
- [x] Set starting point to midpoint of low/high.
- [x] If width `>10`, compress symmetrically to midpoint ±5.
- [x] Derive Q-Air / Baratza / Timemore from K-Ultra via micron conversion tables.

## 6) Release Tasks (AGENTS.md)
- [x] Bump `package.json` version following SemVer with the implementation PR.
- [x] Add user-facing changelog entry in `CHANGELOG.md`.
