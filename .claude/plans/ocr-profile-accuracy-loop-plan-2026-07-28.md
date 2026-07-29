# OCR Profile Accuracy Loop — Plan (2026-07-28)

## Goal

Create a repeatable loop that runs the production browser OCR against every file in `bags/`, compares the extracted `ExtractionResponse.bean` field-by-field against the human reference in `profiles/*.md`, and reports per-field accuracy. Then iterate on the OCR code until the loop reports **100% accuracy on core schema fields** for all 6 bags.

## Confirmed scope

- **Fields in scope (must be 100%):** `bean_name`, `variety`, `process`, `finca`, `producer`, `origin`, `altitude_masl`, `roast_level`, `tasting_notes` — the fields `ExtractionResponse` already supports.
- **Out of scope:** brand, weight, format, drying, lot label (schema/product decisions per the gap analysis).
- **Expected values:** parsed automatically from `profiles/*.md` (frontmatter `coffee:` block + `### Tasting Notes` "Original:" line). No new dependencies.
- **Task extent:** loop harness + OCR fixes until 100%.

## Baseline metadata

- Pre-existing dirty files: **none** (clean working tree at plan time).
- Continuation baseline (2026-07-28, before the current fix batch):
  - Modified: `package.json`, `src/app/scan/page.tsx`, `src/lib/browser-ocr.ts`
  - Untracked task artifacts: this plan, `scripts/ocr-profile-accuracy.mjs`
  - Untracked ambient evidence: `.playwright-mcp/`, root OCR screenshots/source images
- Approved review-fix batch (2026-07-28):
  - Task-owned changes: hardened country-bearing origin preservation and added negative prose regression coverage.
  - Newly observed ambient dirty files: none.
- Task-owned files:
  - `scripts/ocr-profile-accuracy.mjs` (new)
  - `package.json` (new script + version bump)
  - `package-lock.json` (version bump)
  - `CHANGELOG.md`
  - `src/lib/browser-ocr.ts` (fix iterations, as needed)
  - `src/lib/deterministic-ocr-parser.ts` (fix iterations, as needed)
  - `src/lib/__tests__/browser-ocr.test.ts`
  - `src/lib/__tests__/deterministic-ocr-parser.test.ts`

## Comparison rules (enforced by the loop)

- `variety`, `finca`, `producer`, `bean_name`: exact match after accent/case normalization and whitespace collapse.
- `process`, `roast_level`: exact canonical value (`washed`, `natural`, `medium`, `medium-light`, `unknown`, ...).
- `altitude_masl`: exact integer. "Not printed" → field must be absent.
- `origin`: every comma-separated component in the profile value must appear in the extracted origin (accent/case-insensitive; `-`↔`, ` tolerant, e.g. `ACEVEDO-HUILA` ⊇ `Acevedo, Huila`). Parenthetical profile notes like `(country not printed)` are stripped before comparison.
- `tasting_notes`: the canonical expected set (profile notes mapped through the parser's canonical aliases) must be fully present in the extraction, and the extraction must not contain noise fragments (e.g. `Hi`, `igo`, `erh tea`, `Resabio`, redundant `naranja` alongside `naranja dulce`).
- Profile values of `Not printed` / starting `Unknown` → extracted field must be absent or `unknown`.
- Classification per field: `exact` / `partial` / `missing` / `wrong`; summary accuracy = exact fields / in-scope fields. Exit non-zero below 100%.

## Phase A — Loop harness

- [x] 1. Read `.agents/docs/REACT_BEST_PRACTICES.md` (repo requirement before code changes).
- [x] 2. Create `scripts/ocr-profile-accuracy.mjs`:
- [x] 3. Add `test:ocr-profiles` script to `package.json`.
- [x] 4. Run the loop once to establish the baseline report: **44/49 (89.8%)**. Earlier gap-analysis items (curved NATURAL, producer truncation, Bourbon grid, note noise) are already fixed in current code. Remaining: SL28/Pacamara/Pacas/Geisha origin components, geisha `mermelada de frutos del bosque` + `pu-erh tea` notes.

## Phase B — Iterate OCR fixes to 100%

Fix in `src/lib/browser-ocr.ts` / `src/lib/deterministic-ocr-parser.ts`, re-running the loop after each change. Gaps from the 2026-07-23 gap analysis that were already fixed before this task (verified by baseline): Bourbon Rosa grid/variety/process/finca, Geisha process/altitude/split-token noise, Pacas process/producer/redundant note.

Remaining gaps to close:

- [x] 5. **SL28** (`sl28-natural-large.jpeg`): origin `Apaneca, Ilamatepec, Santa Ana` → append country `El Salvador` printed on the bag seal.
- [x] 6. **Geisha** (`gesha-natural-large.jpeg`): origin `El Salvador` → recover `Centroamérica` component; notes → recover `mermelada de frutos del bosque` and `pu-erh tea`.
- [x] 7. **Pacamara + Pacas** (`pacamara-natural.jpg`, `pacas-natural.jpg`): origin `El Salvador` → recover `La Palma, Chalatenango` components.
- [x] 9. Verify SL28, Jaho, Pacamara stay at 100% after each change (no regressions).
- [x] 10. Add/adjust vitest coverage in `src/lib/__tests__/` for each parser fix.
- [x] 11. Loop reports 100% on all 6 bags: **49/49 exact (100.0%)**.

## Phase C — Hygiene & review

- [x] 12. After commit-readiness approval, confirm existing gates still pass: `npm test` (**334/334 passed**), `npm run lint` (**0 errors, 1 non-blocking warning**), and `npm run build` (**passed after rerunning outside the restrictive sandbox**).
- [x] 13. Bump `package.json` version (MINOR: new accuracy tooling + OCR improvements) and update `CHANGELOG.md`.
- [x] 14. Run `review-recent-changes`; report findings and wait before further fixes.
- [x] 15. Apply the approved review fix: only preserve comma-bearing, country-containing text as a full origin when every component is short and location-shaped and the country is a standalone component.
- [x] 16. Rerun focused coverage (**46/46 passed**) and the original-image matrix (**49/49 exact, 100.0%**).
- [x] 17. Rerun `review-recent-changes` after the approved fix; one remaining fragment-path guard issue found.
- [x] 18. Apply the approved location-shaped validation to reassembled country-origin fragments and add a geometry-based prose regression test.
- [x] 19. Repeat focused tests (**46/46 passed**) and the original-image matrix (**49/49 exact, 100.0%**).
- [x] 20. Rerun `review-recent-changes` after the fragment-path fix; no findings.
- [x] 21. After commit-readiness approval, run the full repository validation gates.

## Notes / risks

- Original-resolution images behave differently from sanitized fixtures (gap analysis §1); the loop uses `bags/` originals, so fixes must hold at original resolution — this is the point of the loop.
- Tesseract recognition can be slightly non-deterministic across runs; if a field flaps between runs, treat as a real reliability defect to fix, not a flaky test to tolerate.
- No new runtime or dev dependencies are planned.
