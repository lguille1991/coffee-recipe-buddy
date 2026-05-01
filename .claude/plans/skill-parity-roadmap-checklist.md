# Coffee Recipe Generator Skill Parity Roadmap

## Phase A (High Impact / Fast)
- [x] Implement deterministic temperature engine (`src/lib/skill-temperature-engine.ts`).
- [x] Override LLM `parameters.temperature_c` in `/api/generate-recipe` with deterministic output.
- [x] Add temperature engine tests for washed floral, natural medium-dark, and anaerobic profiles.
- [x] Add freshness-aware deterministic grind offsets in `src/lib/skill-grind-engine.ts`.
- [x] Add grind freshness regression tests for `<7d`, `7–21d`, and `22+d`.
- [x] Consolidate skill reference tables into a shared config module (`src/lib/skill-reference.ts`) used by grind + temperature logic.

## Phase B (Parity Expansion)
- [x] Implement deterministic ratio + brew-time engine (`src/lib/skill-brew-parameters-engine.ts`).
- [x] Override LLM-derived ratio and total brew time in `/api/generate-recipe`.
- [x] Expand process model nuance (honey tiers, carbonic, thermal shock, experimental) with backward-compatible mapping.
- [x] Add deterministic troubleshooting engine aligned with skill references and integrate with auto-adjust route.

## Phase C (Advanced/Optional)
- [x] Add strict grinder table parity mode (direct table-based outputs) with interpolation fallback.
- [x] Add `recipe_mode: standard | four_six` and deterministic 4:6 generation path.
- [x] Reduce LLM scope to narrative/objective/wording once deterministic engines own numeric brew parameters.

## Verification & Release Tracking
- [x] Add/expand integration tests covering deterministic overrides in `/api/generate-recipe`.
- [x] Ensure post-override validation passes for all deterministic mutation paths.
- [x] Update `CHANGELOG.md` with user-facing notes for each completed phase.
- [x] Bump `package.json` version per SemVer for each implementation batch.
