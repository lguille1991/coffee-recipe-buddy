# Analysis Editability + Validation Plan (2026-05-04)

## Baseline metadata
- [x] Pre-existing dirty files at baseline: none (`git status --short` clean).
- [x] Task-owned files for this change:
  - `src/app/analysis/page.tsx`
  - `src/app/analysis/page.test.tsx` (new)
  - `package.json` (patch SemVer bump required for runtime behavior/UI change)
  - `CHANGELOG.md` (user-facing update entry)

## Implementation checklist
- [x] Replace generic editable controls for roast/process/altitude on analysis with specialized controls:
  - Roast: dropdown using canonical `BeanProfile` roast enum values with friendly labels.
  - Process: dropdown using full canonical schema set with friendly labels:
    - `washed`, `natural`, `honey`, `anaerobic`, `carbonic`, `thermal_shock`, `experimental`, `unknown`.
  - Altitude: numeric text input (digits only, no suffix in field), with `masl` presented as adjacent label/helper.
- [x] Preserve existing test IDs for compatibility:
  - Keep primary control IDs unchanged: `roast-level-input`, `bean-process`, `altitude`.
  - Add deterministic option-level IDs for dropdown options.
- [x] Add explicit editability affordances on analysis bean profile section:
  - Section hint copy indicating values can be reviewed/edited.
  - Per-field editable badge/icon in header.
  - Badge layout rule: `Editable` badge on left near label, low-confidence badge on right.
- [x] Add live and submit-time altitude validation using one shared validator for both save actions:
  - Valid only whole-number `300–3000`.
  - Blank remains allowed.
  - Invalid non-empty values show inline error immediately, including prefilled invalid extraction values on first render.
  - Invalid state blocks `Save Coffee` and `Save + Generate Recipe`.
- [x] Keep roast/process default behavior unchanged when extraction is uncertain:
  - `process: unknown`, `roast_level: medium` remain safe defaults.
- [x] Keep `coffee-name` and `bean-origin` untrimmed and enforce max length 150:
  - Set input maxLength to 150.
  - If prefilled extraction value exceeds 150, show inline error and block both submit paths until user fixes it.
  - Do not auto-truncate.
- [x] Refactor analysis field state as needed so validation supports intermediate invalid input and explicit error UI.
- [x] Add analysis-focused tests covering:
  - Editability cues visibility (section hint + per-field editable badge/icon).
  - Dropdown canonical option behavior/state updates for roast and full process set.
  - Altitude live validation, first-render invalid prefill behavior, and submit blocking for both save flows.
  - Max-length (150), no-trim behavior, and submit blocking for over-limit `coffee-name`/`bean-origin`.
  - Test harness dependencies for this page (`recipeSessionStorage`, `next/navigation`, auth/profile hooks, feature flags, nav-guard context).

## Release hygiene checklist
- [x] Bump `package.json` patch version (SemVer patch for UI/validation refinement).
- [x] Add corresponding `CHANGELOG.md` user-facing entry.

## Post-implementation workflow (per repo policy)
- [ ] Run immediate review of recent changes (findings-first).
- [ ] Report findings and wait for approval before any fix batch.
- [ ] After review passes, ask for commit-readiness confirmation.
- [ ] On commit-readiness approval, run validation gates:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- [ ] If all gates pass, provide concise recommended commit message(s).
