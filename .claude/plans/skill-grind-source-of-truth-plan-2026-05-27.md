# Skill Grind Source Of Truth Plan

## Baseline Metadata

- Pre-existing dirty files observed while revising this plan:
  - `CONTEXT.md` (`git status --short`: modified)
  - `.claude/plans/skill-grind-source-of-truth-plan-2026-05-27.md` (`git status --short`: untracked plan artifact)
  - `docs/adr/` (`git status --short`: untracked directory; provenance to be confirmed before implementation)
- Task-owned files for implementation:
  - `coffee-recipe-generator/references/grind-determinants.md`
  - `coffee-recipe-generator/references/grinder-settings.md`
  - `coffee-recipe-generator/SKILL.md`
  - `docs/grinder-tables/fellow-opus-grind-table.md`
  - `docs/grinder-tables/timemore-c2-grind-table.md`
  - `docs/coffee-range-system-skill.md`
  - `docs/output-format.md`
  - `src/lib/prompt-builder.ts`
  - `src/lib/skill-reference.ts`
  - `src/lib/skill-grind-engine.ts`
  - `src/lib/grind-settings.ts`
  - `src/lib/grinder-converter.ts`
  - `src/lib/recipe-generation.ts`
  - `src/app/api/generate-recipe/route.ts`
  - `src/app/api/recipes/from-profile/route.ts`
  - `src/lib/__tests__/skill-grind-engine.test.ts`
  - `src/lib/__tests__/grind-policy-consistency.test.ts`
  - `src/app/api/generate-recipe/route.test.ts`
  - `src/app/api/recipes/from-profile/route.test.ts`
  - `CHANGELOG.md`
  - `package.json`
- Mixed-provenance paths that must be re-baselined before implementation ownership is assigned:
  - `CONTEXT.md`
  - `docs/adr/0001-skill-owned-grind-policy.md`
- Policy read: `.agents/docs/REACT_BEST_PRACTICES.md`.
- ADR: `docs/adr/0001-skill-owned-grind-policy.md` records the source-of-truth decision.
- Review scope rule derived from the current dirty baseline:
  - If mixed-provenance files stay dirty at implementation start, review those files as mixed provenance and review task-owned file diffs separately rather than assuming a clean-baseline full diff.

## Goal

Make the app's generated recipe grind settings match the `coffee-recipe-generator` skill's grind calculation logic, with the skill references treated as the single source of truth.

## Out Of Scope

- Temperature parity between the app and skill.
- Brew ratio, water, time, and pour-step parity between the app and skill.
- Coffee profile schema expansion for process subtypes such as white/yellow/red/black honey.
- `four_six` grind parity unless `coffee-recipe-generator/references/4-6-method.md` is reconciled in a separate pass.
- Refactoring non-grind deterministic engines except where needed to keep existing generation flow working.

## Approval Gate

- [ ] Stop after plan approval and before any implementation work.
  - No Phase 1 or Phase 2 file edits begin until the user explicitly approves implementation.
  - This gate applies to skill/reference markdown changes as well as app/runtime/test changes.
  - If baseline metadata changes again before implementation starts, update this plan first and then wait for approval again if the execution scope materially changes.

## Phase 1: Documentation And Reference Reconciliation

- [ ] Accept temporary app/skill divergence during Phase 1.
  - Phase 1 may change future `coffee-recipe-generator` skill outputs before app runtime behavior changes.
  - Do not change app runtime generation behavior in Phase 1.
  - Make handoffs clear that the app remains temporarily divergent until Phase 2 implementation lands.

- [ ] Confirm canonical behavior from the skill references.
  - Treat `coffee-recipe-generator/references/grind-determinants.md` as the canonical determinant stack: method base, processing, origin/altitude, roast, variety.
  - Treat `coffee-recipe-generator/references/grinder-settings.md` as the canonical grinder table reference and output notation source.
  - Update `coffee-recipe-generator/references/grinder-settings.md` before app refactoring so it includes all app-supported grinders: K-Ultra, Q-Air, Baratza Encore ESP, Timemore C2, and Fellow Opus.
  - Use `docs/grinder-tables/fellow-opus-grind-table.md` and `docs/grinder-tables/timemore-c2-grind-table.md` only as seed material for updating the skill reference, not as permanent app-side supplemental sources.
  - When seed tables conflict with existing skill wording or examples, resolve the conflict in favor of explicitly documented skill rules or newly documented skill decisions made in this phase; do not preserve app behavior solely because it already exists in app code or app-side tables.
  - Remove freshness from app grind calculation for this refactor because it is not part of the skill's canonical grind determinant stack.

- [ ] Reconcile skill reference arithmetic before translating it into app code.
  - Treat worked examples in `coffee-recipe-generator/references/grind-determinants.md` as normative regression fixtures after their arithmetic is made internally consistent.
  - Move any app-required method-specific base ranges into the skill reference before implementation, including Origami, Orea V4, Hario Switch, Ceado Hoop, and Pulsar if they should differ from generic Pour Over.
  - If a brewer does not need a distinct skill rule, explicitly map it to a generic skill category such as Pour Over in the skill wording.
  - Update skill wording where needed so examples such as El Salvador Gesha Natural `~0.6.0–0.7.5` can be derived from explicit written rules.
  - Update `coffee-recipe-generator/SKILL.md` lightly if needed to state that app-compatible grinder references cover every supported grinder and that app profiles use generic fallbacks when schema subtypes are unavailable.
  - Keep detailed grind rules in reference files rather than overloading `SKILL.md`.
  - Avoid encoding implied app rules that are only reverse-engineered from examples but not stated in the skill reference.
  - Avoid preserving app-only brewer base ranges after the refactor.
  - Lock the reconciled examples into app tests only after the skill text explains how to calculate them.

- [ ] Freeze brewer mapping decisions in the plan before implementation.
  - Record a concrete brewer-to-skill-category mapping table in this plan or in the referenced ADR before any app code changes begin.
  - At minimum, explicitly decide whether Origami, Orea V4, Hario Switch, Ceado Hoop, and Pulsar each get distinct rules or map to a generic category such as Pour Over.
  - Name the approval checkpoint for that mapping as user approval of the revised Phase 1 references plus this plan.

- [ ] Update the skill tables before app refactor.
  - Add a Fellow Opus section to `coffee-recipe-generator/references/grinder-settings.md` using the existing app table only as seed material to be reconciled against the canonical skill policy.
  - Confirm whether the existing Timemore C2 section in `coffee-recipe-generator/references/grinder-settings.md` is sufficient or should be reconciled with `docs/grinder-tables/timemore-c2-grind-table.md`.
  - Make the app implementation point only to skill references for all supported grinders after the skill table update.

- [ ] Encode canonical skill rules as stable app constants.
  - Copy the reconciled skill markdown values into TypeScript constants rather than parsing markdown at runtime.
  - Add comments beside constants that point to the exact canonical skill reference files.
  - Use regression tests for reconciled skill examples to detect drift between app constants and skill docs.
  - Consider a later build-time drift check, but do not couple production recipe generation to markdown parsing or formatting.

- [ ] Replace competing app grind modes with one canonical app implementation.
  - Remove behavioral branching for `SKILL_GRIND_PARITY_MODE=skill_v2` in `src/lib/skill-grind-engine.ts`.
  - Remove behavioral branching for `STRICT_GRINDER_TABLE_PARITY`.
  - Tolerate old env variables as harmless no-ops for one release if they remain in `.env.local` or deployment settings.
  - Rename the implementation concept from "parity mode" to "skill reference grind policy" so future code does not imply multiple valid policies.
  - Keep implementation aligned with `docs/adr/0001-skill-owned-grind-policy.md`.
  - Keep current non-grind deterministic recipe-generation behavior intact unless a change is required to isolate grind policy.

- [ ] Retire or neutralize competing prompt-side grind docs.
  - Remove `docs/coffee-range-system-skill.md` from the numeric grind decision path, rename it, or update it to mirror/defer to the canonical `coffee-recipe-generator` skill references exactly.
  - If prompt docs remain injected, make them explicit that numeric grind and `range_logic` are server-overridden from the canonical skill policy.
  - Update `src/lib/prompt-builder.ts` and prompt tests so stale app-specific grind rules are not presented as an alternate source of truth.
  - Keep `docs/output-format.md` only for schema shape if needed, not policy selection.

## Phase 2: App Implementation

- [ ] Implement only after Phase 1 references are reconciled and approved.
  - Approval means explicit user approval after the revised Phase 1 references, method mapping decisions, and this plan are updated.
  - Copy stable, reconciled skill values into TypeScript constants.
  - Use Phase 1 examples and wording as the source for app tests.

- [ ] Align method base ranges with the skill.
  - Use the K-Ultra method table from `coffee-recipe-generator/references/grinder-settings.md`.
  - Preserve the skill's descriptive base categories from `grind-determinants.md` for `range_logic.base_range`.
  - Resolve current conflicts where the app uses tighter `skill_v2` bases like V60 `72–79` while the skill table says V60 `0.5.3–0.9.2`.
  - Ensure every app-supported method is either explicitly represented in the skill reference or intentionally mapped to a skill-defined generic method category.

- [ ] Align determinant offsets with the skill.
  - Washed: base/no coarsening or fining unless another determinant applies.
  - Natural: coarser by the skill range, currently `+1–3`.
  - Honey: keep the current `process: "honey"` app enum and implement a conservative generic honey fallback.
  - Update skill wording to explain that app profiles without white/yellow/red/black honey subtype data use the generic honey fallback.
  - Do not expand the coffee profile schema for honey subtypes in this refactor.
  - Anaerobic/experimental/carbonic/thermal shock: coarser according to the skill's ranges.
  - Altitude: high altitude begins at `1200m+` per the skill, not only `1400m+`.
  - Roast: light shifts finer by skill logic; medium stays base; medium-dark/dark shift coarser.
  - Variety: Pacamara/Maragogipe coarser; Gesha/Geisha and Ethiopian heirloom finer; Typica/Bourbon/SL28/SL34/Caturra/Catuai base.
  - Missing optional origin/altitude/variety values use neutral fallback offsets and are called out in `range_logic`.
  - `process: "unknown"` uses neutral/base behavior and is called out in `range_logic`; do not reject otherwise valid saved profiles solely because process is unknown.

- [ ] Preserve determinant offset ranges through the calculation.
  - Treat higher K-Ultra clicks as coarser and lower K-Ultra clicks as finer.
  - Represent every determinant as a signed `[lowDelta, highDelta]` range in K-Ultra clicks.
  - Add determinant ranges low-to-low and high-to-high to the current operating range.
  - Clamp final K-Ultra ranges only to the canonical skill table's broad supported K-Ultra bounds: `6–100` clicks (`0.0.6–1.0.0`).
  - Do not clamp to old app comfort zones or pour-over policy ranges.
  - Treat unexpected clamp hits for normal supported methods as a signal to revisit skill arithmetic rather than silently accepting distorted output.
  - Mention K-Ultra clamp hits in `range_logic.final_operating_range` or adjacent top-level grind explanation because K-Ultra is canonical.
  - Model skill offsets as low/high ranges, such as natural `+1–3` clicks and light roast `-2–0` clicks.
  - Add each determinant's low/high offset to the current low/high operating range instead of collapsing each determinant to a single value.
  - Choose the final `starting_point` only after all determinant ranges are applied, using `Math.round((low + high) / 2)` on the final K-Ultra click range.
  - Let `.5` midpoint cases round coarser, such as `60–75` clicks producing `68` clicks (`0.6.8`).
  - Remove the hard `≤ 10 K-Ultra clicks` compression rule from the canonical skill path so skill-derived ranges such as `0.6.0–0.7.5` remain intact.
  - Record each determinant's range in tests and `range_logic` so app output is explainable.

- [ ] Rework `range_logic` to mirror the skill's decision order.
  - Record method base, processing adjustment, origin/altitude adjustment, roast adjustment, variety adjustment.
  - Preserve existing `range_logic` field names for recipe JSON compatibility.
  - Use `density_offset` as the compatibility field for the skill's origin/altitude and variety explanations in decision order, such as `origin/altitude: -1–-2 clicks; variety: -1–0 clicks`.
  - Remove freshness from grind `range_logic`; roast date can still be used elsewhere, but not to alter canonical grind.
  - Preserve the existing recipe JSON shape for compatibility, but set `compressed: false` for canonical skill grinds because wide ranges are valid skill output rather than a condition to correct.
  - Keep `grind.k_ultra.range` and `range_logic.final_operating_range` formatted as raw clicks, such as `60–75 clicks`.
  - Keep `grind.k_ultra.starting_point` and `range_logic.starting_point` formatted as K-Ultra notation, such as `0.6.8`.
  - Keep final operating range and starting point explainable in K-Ultra clicks plus rendered grinder notation.
  - Before shipping any `range_logic` semantic changes, audit downstream consumers in API tests, UI displays, edit flows, analytics/debug output, and saved recipe readers for assumptions about `density_offset`, `compressed`, and formatting.
  - If a consumer depends on old semantics, either preserve the old contract, add an explicit compatibility translation, or narrow the scope and document the deferred breakage instead of silently redefining field meaning.

- [ ] Keep secondary grinder outputs derived from canonical K-Ultra values.
  - Continue using K-Ultra clicks as the single internal canonical calculation scale.
  - Do not implement separate determinant calculations per grinder.
  - Use the skill's multi-grinder tables to validate/display conversion behavior from the canonical K-Ultra range.
  - Convert secondary grinder ranges with outward rounding: lower endpoint rounds down, upper endpoint rounds up.
  - Convert secondary grinder `starting_point` values with nearest valid step rounding.
  - For Fellow Opus, outward range rounding uses the nearest lower/upper `0.25` step.
  - For Baratza Encore ESP and Timemore C2, outward range rounding uses lower/upper whole clicks.
  - For Q-Air, use existing `R.C.M` granularity where one rotation equals 30 micro-steps; floor/ceil range endpoints in raw micro-steps and round starting points to the nearest micro-step before formatting back to `R.C.M`.
  - Clamp secondary grinder ranges to each grinder's canonical skill-table bounds after outward rounding.
  - Do not display impossible grinder settings outside canonical table bounds.
  - Treat unexpected secondary-grinder clamp hits for normal supported recipes as a signal to reconcile conversion tables.
  - Mention secondary-grinder clamp hits in that grinder's `note` field if needed, not in top-level `range_logic`.
  - Continue including every supported grinder in structured generated recipe output, regardless of the user's preferred/named grinder.
  - Use the user's preferred grinder only to choose primary display/edit emphasis, not to decide which grinder data is generated or saved.
  - Verify Q-Air and Baratza Encore ESP conversions against `coffee-recipe-generator/references/grinder-settings.md`.
  - Verify Timemore C2 against the updated skill table; use `docs/grinder-tables/timemore-c2-grind-table.md` only to reconcile the skill table before implementation.
  - Verify Fellow Opus against the updated skill table after seeding it from `docs/grinder-tables/fellow-opus-grind-table.md`.
  - Do not remove `fellow_opus` or `timemore_c2` from recipe schema, saved recipe migrations, generated API output, detail displays, edit flows, or tests during this refactor.
  - Remove app-only clamps that conflict with the skill tables, or document why they remain as display safety constraints.

- [ ] Align validation with canonical skill output.
  - Keep validation for recipe JSON shape, grinder setting format, and basic physical grinder bounds.
  - Remove or relax old app policy guardrails that reject canonical skill-derived grinder settings.
  - If a guardrail conflict appears, reconcile the skill reference first or remove the app-only guardrail rather than overriding canonical generated grinds.

- [ ] Scope canonical grind policy to new generation only.
  - Apply the new skill-derived grind policy to newly generated recipes from `/api/generate-recipe` and `/api/recipes/from-profile`.
  - For standard recipe generation, make canonical grind a pure function of brew method plus bean determinants.
  - Keep `four_six` recipe mode on its existing special-mode grind behavior for this refactor.
  - Ensure route, goal, water mode, and target water amount do not change canonical grind for the same bean and method.
  - Do not backfill or recompute historical saved recipes solely because the policy changed.
  - Preserve existing saved recipe grind values when reading, displaying, sharing, or migrating old records.
  - Treat explicit regeneration as new generation that uses the canonical skill policy.
  - Keep auto-adjust and manual edit flows anchored to the recipe's existing saved grind values rather than recomputing from bean determinants.
  - Allow auto-adjust/manual edit to change grind only as an adjustment from the saved recipe baseline.

- [ ] Update API env behavior.
  - Stop exposing `_debug.grind_parity_mode` once there is only one grind policy, or replace it with `_debug.grind_policy: "coffee-recipe-generator"`.
  - Ensure debug output/docs do not imply `SKILL_GRIND_PARITY_MODE` or `STRICT_GRINDER_TABLE_PARITY` still choose behavior.
  - Update `/api/generate-recipe` and `/api/recipes/from-profile` tests so old env vars can be present without changing generated grind behavior.
  - Keep `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES` unchanged because it is unrelated to grind policy.

- [ ] Add regression tests using skill examples.
  - Add a test for the reconciled El Salvador Gesha Natural skill example and expect the explicit canonical K-Ultra range from the updated skill text.
  - Add a test for the reconciled Brazilian Natural Medium-Dark skill example and expect the explicit canonical K-Ultra range from the updated skill text.
  - Assert both final K-Ultra operating ranges and midpoint-derived `starting_point` values, not only single starting points.
  - Add a midpoint rounding test proving odd-width ranges use `Math.round((low + high) / 2)`.
  - Add a test proving skill-derived ranges wider than 10 K-Ultra clicks are not compressed.
  - Add tests proving final K-Ultra ranges clamp only to `6–100` clicks and normal supported-method examples do not unexpectedly hit the clamp.
  - Add tests for washed coffee staying at method base unless roast/altitude/variety shift it.
  - Add tests for altitude threshold differences around `1199`, `1200`, and low-altitude coffees.
  - Add a test proving two otherwise identical beans produce the same grind output regardless of `roast_date`.
  - Add tests for neutral fallback offsets when origin, altitude, variety, or process are unknown/missing.
  - Add a generated-recipe output contract test proving all supported grinders are present even when one preferred grinder is selected for display.
  - Add endpoint parity tests proving `/api/generate-recipe` and `/api/recipes/from-profile` return the same grind bundle for the same standard recipe bean and method.
  - Add tests proving goal, water mode, and target water amount do not alter canonical grind for the same standard recipe bean and method.
  - Add or preserve tests proving `four_six` mode is not forced through the standard canonical grind policy in this refactor.
  - Add compatibility tests proving generated recipes still include valid `fellow_opus` and `timemore_c2` grind settings after the canonical K-Ultra calculation changes.
  - Add conversion-boundary tests for Fellow Opus quarter-step formatting and Timemore C2 click formatting.
  - Add conversion tests proving secondary grinder ranges round outward while starting points round to nearest valid step.
  - Add conversion tests proving secondary grinder outputs clamp only to canonical skill-table bounds after outward rounding.
  - Add tests proving validation accepts canonical skill-derived grinder settings even when they would have violated old app-only pour-over guardrails.
  - Add or preserve tests proving saved historical recipes are not recomputed on read/migration solely due to the new generation policy.
  - Add or preserve tests proving auto-adjust/manual edit flows adjust from existing saved grind values instead of recomputing canonical bean-determinant grinds.
  - Add prompt-builder tests proving generated prompts do not inject stale competing numeric grind policy.
  - Add tests covering any compatibility handling chosen for `range_logic` semantic changes.

- [ ] Update release hygiene after code changes.
  - Bump `package.json` patch version because this is a recipe-generation behavior refinement.
  - Add a user-facing `CHANGELOG.md` entry: "New generated recipe grind settings now use the coffee-recipe-generator skill references as the canonical policy across all supported grinders."
  - Keep old env-flag no-op details in developer docs/ADR rather than the user-facing changelog line.

## Phase 3: Review And Validation

- [ ] Review immediately after implementation.
  - Run `review-recent-changes` if available; otherwise manually review the task-owned diff findings-first.
  - If the baseline is clean at implementation start, review the full working-tree diff.
  - If mixed-provenance files remain dirty at implementation start, review task-owned file diffs plus mixed-provenance file diffs explicitly labeled as mixed provenance.
  - Report findings and wait before further fixes, following the repo workflow.

- [ ] Validate only after commit-readiness approval.
  - Run `npm test`.
  - Run `npm run lint`.
  - Run `npm run build`.
  - If validation passes, provide a recommended commit message.

## Recommended Simplest Viable Path

- [ ] Do not parse markdown dynamically at runtime.
- [ ] Encode the skill's canonical grind policy in TypeScript constants with comments pointing to the exact skill reference files.
- [ ] Update `coffee-recipe-generator/references/grinder-settings.md` first so `fellow_opus` and `timemore_c2` are canonical skill-supported grinders before the app refactor begins.
- [ ] Update tests to lock the app to the skill examples.
- [ ] Later, if desired, add a build-time script to detect drift between markdown references and TypeScript constants.
