# Coffee Bag OCR Original-Input Gap Fixes

## Goal

Make local browser OCR produce the same reliable core coffee profile from production-like original bag photos as it does from the current optimized fixtures, without introducing hosted OCR, generative extraction, or broad text guessing.

Progress is tracked through the checkboxes in this file. The human-reference profiles and the consolidated evidence remain in `profiles/`.

## Baseline metadata

- Baseline date: `2026-07-23`.
- Current branch: `chore/continue-deterministic-workflow`.
- Baseline version: `2.0.4`; implementation version: `2.0.5`.
- Pre-existing dirty files:
  - `profiles/1200 Cafe - SL28 Natural - La Divina.md`
  - `profiles/DLa Palma - Geisha Natural - Loma Verde.md`
  - `profiles/DLa Palma - Pacamara Natural - Las Ventanas.md`
  - `profiles/DLa Palma - Pacas Natural - El Roble.md`
  - `profiles/Jaho - Minas Washed - Brazil.md`
  - `profiles/OCR Gap Analysis - Original Coffee Bags.md`
  - `profiles/Tropicalia - Bourbon Rosa Washed - Bella Vista.md`
- The six files under `bags/` are clean, user-supplied diagnostic sources. Treat them as read-only and do not alter their pixels or metadata.
- Current task-owned files:
  - `.claude/plans/coffee-bag-ocr-original-input-gap-fixes-plan-2026-07-23.md`
  - `src/lib/browser-ocr.ts`
  - `src/lib/deterministic-ocr-parser.ts`
  - `src/lib/__tests__/browser-ocr.test.ts`
  - `src/lib/__tests__/deterministic-ocr-parser.test.ts`
  - `scripts/e2e-ocr-ui.mjs`
  - six production-equivalent, metadata-safe fixtures under `tests/fixtures/coffee-bags-original/`
  - `package.json`
  - `package-lock.json`
  - `CHANGELOG.md`
- Refresh this metadata before each approved rework batch if task-owned or ambient dirty files change.
- Implementation baseline reproduction: the metadata-safe matrix failed Bourbon (`Se a`, unknown process, wrong grid origin), Geisha (unknown process and missing altitude), and Pacas (unknown process, truncated producer, redundant `naranja`) before production code changed.
- Ambient dirty files remained limited to the seven pre-existing untracked files under `profiles/`.
- Approved review-fix batch date: `2026-07-23`; task-owned files and ambient dirty files are unchanged from the implementation baseline.

## Scope boundaries

- [x] Preserve browser-side, same-origin OCR with the existing local Tesseract assets.
- [x] Preserve current supported process and roast vocabularies and keep genuinely unreadable fields unknown.
- [x] Do not expand the coffee profile schema for brand, weight, bag format, drying method, edition labels, fragrance, body, or aftertaste in this batch.
- [x] Do not tune rules solely to filenames or one specific bag; recovery rules must be bounded by OCR confidence, vocabulary, and layout context.
- [x] Do not modify the six source images in `bags/`.

## Completed diagnosis

- [x] Visually transcribe all six source bags into human-reference Markdown profiles.
- [x] Run the authenticated local Scan → Analysis flow against all six original files.
- [x] Capture the structured local OCR output and compare it field by field with the reference profiles.
- [x] Confirm Bourbon has major variety/process/grid-association errors.
- [x] Confirm Geisha loses `natural` and altitude and fragments tasting notes.
- [x] Confirm Pacas loses `natural`, truncates the producer, and emits a redundant shorter tasting note.
- [x] Confirm Jaho, Pacamara, and SL28 currently pass their core-field expectations.
- [x] Identify a concrete crop-control defect: the identity rectangle is computed, but the fallback scans the broad top band instead.
- [x] Confirm the identity fallback is gated only on missing variety, so it does not run when variety exists but process remains unknown.
- [x] Confirm OCR pass merging currently deduplicates by normalized text without considering spatial location.
- [x] Confirm the Bourbon table parser relies on line order/splitting rather than independently matching header and value columns.

## Implementation sequence

### 1. Lock production-equivalent failures into regression coverage

- [x] Create metadata-safe fixtures that preserve the production inputs' rendered orientation, pixel geometry, and OCR-relevant image characteristics as closely as possible.
- [x] Keep the existing optimized fixtures as a separate regression layer; do not replace them.
- [x] Extend `scripts/e2e-ocr-ui.mjs` so the same core-field expectations can run against both fixture sets.
- [x] Assert the stored structured extraction and rendered Analysis controls for each bag.
- [x] Run the production-equivalent matrix before production edits and record Bourbon, Geisha, and Pacas failing for the expected reasons.
- [x] Add or select focused unit regressions for the observed fragment, crop, table, and tasting-note behaviors.

### 2. Correct and bound targeted OCR crops

- [x] Build the identity pass from the actual `identityCropForPortraitBag` rectangle instead of reusing the broad top band.
- [x] Trigger the identity fallback when either variety is missing or process remains `unknown`.
- [x] Use `varietyCropForPortraitBag` when variety remains missing after the identity pass.
- [x] Run only the smallest measured set of targeted color/grayscale and page-segmentation variants needed to recover the failing identity text.
- [x] Prefer sparse-text segmentation for composed identity regions and single-line segmentation only for genuinely line-like crops.
- [x] Preserve normalized full-image bounding boxes and distinct source provenance for every crop result.
- [x] Keep extra recognition passes conditional, preserve monotonic progress, honor cancellation between passes, and terminate the shared worker reliably.
- [x] Add helper tests proving the requested rectangle—not a neighboring band—is rendered and mapped back into full-image coordinates.

### 3. Reconcile OCR blocks without losing layout

- [x] Replace text-only deduplication with spatially aware deduplication using normalized text plus overlap/proximity.
- [x] Preserve identical text that appears in genuinely different image locations.
- [x] Prefer the strongest overlapping reading while retaining useful alternate fragments from other passes.
- [x] Join bounded adjacent fragments on the same baseline or within the same labelled region.
- [x] Cover split-token cases equivalent to `1200` + `msnm`, `Hi` + `go`, and `Saúl` + `Gutierrez`.
- [x] Reject joins across distant blocks, unrelated sections, or incompatible OCR sources/layouts.

### 4. Strengthen deterministic field mapping

- [x] Map table headers to values by horizontal column geometry and vertical proximity rather than assuming one three-part value line.
- [x] Validate each table candidate before assignment:
  - producer must be a plausible person/family value,
  - origin must not be a field label or altitude,
  - finca must not be a header or process token.
- [x] Prevent `CAFICULTORA` or another header fragment from becoming the origin.
- [x] Reconcile altitude numbers and accepted units across bounded neighboring fragments/passes.
- [x] Reconcile producer-name continuations only inside a farm/producer identity context.
- [x] Replace the growing list of exact damaged `natural` aliases with bounded edit-distance matching against closed process vocabulary, gated by identity context and minimum confidence.
- [x] Keep prose such as “our natural landscape” from becoming a process.
- [x] Normalize tasting notes globally by preferring the longest recognized phrase, so `naranja dulce` suppresses redundant `naranja`.
- [x] Preserve current false-positive protections for weights, dates, marketing copy, countries, and unsupported roast wording such as `Brew`.

### 5. Acceptance matrix

- [x] Bourbon: `Bourbon Rosa`, `washed`, `Bella Vista`, `Familia Plazas`, `Acevedo-Huila`, `1750`, and manzana/mandarina/panela; roast remains unknown.
- [x] Geisha: `Geisha`, `natural`, `Loma Verde`, `Esperanza Aguilar`, `El Salvador`, `1200`, medium-light, and clean recognized tasting notes.
- [x] Jaho: `Minas`, `washed`, `Brazil`, medium, and all three printed tasting notes remain correct.
- [x] Pacamara: `Pacamara`, `natural`, `Las Ventanas`, `Yobani Ochoa`, `El Salvador`, `1450`, and the existing recognized notes remain correct.
- [x] Pacas: `Pacas`, `natural`, `El Roble`, `Saúl Gutierrez`, `El Salvador`, `1800`, and the expected notes without redundant `naranja`.
- [x] SL28: `SL28`, `natural`, `La Divina`, `Roberto Ulloa`, full Apaneca/Ilamatepec/Santa Ana origin, `1550`, and all four notes; `Brew` remains an unknown roast.
- [x] All six production-equivalent inputs pass the authenticated Scan → Analysis matrix.
- [x] All six existing optimized fixtures continue to pass the same core-field matrix.
- [x] No scan uses `/api/extract-bean`, OpenRouter, or another third-party OCR/extraction endpoint.
- [x] Focused unit tests pass without weakening confidence or false-positive boundaries.

### 6. Release hygiene and immediate review

- [x] Recheck the task-owned file list and ambient dirty files.
- [x] Bump `package.json` and `package-lock.json` from `2.0.4` to `2.0.5`.
- [x] Add a concise user-facing `CHANGELOG.md` entry for improved original-photo OCR reliability.
- [x] Mark every completed implementation and acceptance item in this plan.
- [x] Run `review-recent-changes` immediately after implementation.
- [x] Review only task-owned diffs while explicitly preserving the pre-existing untracked profile files.
- [x] Report review findings and wait for approval before applying any review-fix batch.

### 7. Approved review-fix batch

- [x] Require same-run identity evidence for the loose damaged-`natural` edit-distance fallback.
- [x] Cluster geometric table headers by local row and resolve each row direction independently.
- [x] Restrict fragment alternates to confident, immediate short-fragment joins without all-pairs scanning.
- [x] Add focused negative and mixed-layout regressions for all three review findings.
- [x] Recheck release hygiene; keep the completed batch at `2.0.5`.
- [x] Rerun focused tests and the two-layer OCR acceptance matrix.
- [x] Run `review-recent-changes` again and report findings before any further fixes.

### 8. Approved E2E fail-fast fix

- [x] Reject unsupported `OCR_E2E_FIXTURE_SET` values before starting the app.
- [x] Reject `OCR_E2E_CASE` filters that match no declared bag case before starting the app.
- [x] Exercise both invalid-filter paths and a valid filtered selection.
- [x] Recheck release hygiene; keep the unreleased fix batch at `2.0.5`.
- [x] Run `review-recent-changes` again and report findings before any further fixes.

## Commit-readiness checkpoint

- [ ] If review has no unresolved findings, ask for explicit commit-readiness approval.
- [ ] Only after approval, run:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e:ocr-ui`
- [ ] If validation fails, report the exact failure and request approval before fixes, then return to implementation and immediate review.
- [ ] When all gates pass, provide at least one concise Conventional Commit recommendation.

## Suggested commit message after successful validation

`fix(ocr): improve extraction from original coffee bag photos`
