# Coffee Bag OCR Reliability

## Baseline metadata

- Pre-existing dirty files:
  - `bags/bourbon-rosa-large.jpeg`
  - `bags/gesha-natural-large.jpeg`
  - `bags/jaho-brazil-washed.jpg`
  - `bags/pacamara-natural.jpg`
  - `bags/pacas-natural.jpg`
  - `bags/sl28-natural-large.jpeg`
- The six source photos are user-owned diagnostic inputs, not task-owned files. Some contain camera/GPS EXIF metadata; do not modify or commit them directly.
- Task-owned files:
  - `.claude/plans/coffee-bag-ocr-reliability-plan-2026-07-23.md`
  - `src/lib/browser-ocr.ts`
  - `src/lib/deterministic-ocr-parser.ts`
  - `src/lib/__tests__/browser-ocr.test.ts`
  - `src/lib/__tests__/deterministic-ocr-parser.test.ts`
  - `src/app/analysis/page.tsx`
  - `src/app/analysis/page.test.tsx`
  - `scripts/e2e-ocr-ui.mjs`
  - sanitized coffee-bag image fixtures created from the six source photos, if their size is reasonable
  - `package.json`
  - `package-lock.json`
  - `CHANGELOG.md`
- Current version: `2.0.3`; this bug fix requires a PATCH bump to `2.0.4`.
- Current branch: `chore/continue-deterministic-workflow`.
- Preserve the v2 architectural invariant: bag extraction remains browser-side, same-origin, and independent of hosted/generative AI.

## Reproduction and evidence

- [x] Run the real authenticated Scan → Analysis browser flow against all six images.
- [x] Record current form values and the stored `ExtractionResponse` for each image.
- [x] Compare the rendered fields with the legible bag text.
- [x] Confirm the existing E2E harness is too weak: it intentionally expects visible fields such as Gesha `Natural` and `1200 msnm` to remain unknown/blank, and it does not cover the new Pacamara/Pacas samples.
- [x] Separate the failure into:
  - OCR transcription loss caused by a single grayscale preprocessing path, downscaling, stylized/curved colored text, small labels, and insufficient fallback crops.
  - Deterministic mapping loss caused by discarding layout geometry, pairing a standalone label only with the immediately following block, rejecting nearby bare altitude numbers after their unit is misread, not collecting multiline values, and ignoring compact product-name/process layouts.
- [x] Confirm Scan → sessionStorage → Analysis rendering itself works for fields that reach the extraction object.

### Current observed output

| Bag | Current Analysis result | Confirmed missing/wrong fields |
|---|---|---|
| Bourbon Rosa | `Bourbon Rosa`; washed; roast unknown; no origin/altitude | Bella Vista, Familia Plazas, Acevedo-Huila, 1750 msnm, tasting notes |
| Geisha Natural | `Geisha · Loma Verde`; process unknown; medium-light; no altitude | Natural, Esperanza Aguilar, 1200 msnm, origin, complete notes |
| Jaho Brazil Washed | blank name/origin; washed; medium | Minas product name, Brazil, tasting notes |
| Pacamara Natural | `Pacamara · Las Ventanas · Yobani Ochoa`; natural; no altitude | 1450 msnm, origin, complete notes |
| Pacas Natural | `El Roble · S`; process/roast unknown; 1800 msnm | Pacas, Natural, full producer name, origin, complete notes |
| SL28 Natural | core identity/process/altitude present | Region is truncated before Santa Ana; roast should remain unknown because `Brew` is not a supported roast level |

## Acceptance matrix

- [x] Bourbon Rosa maps legible values to: variety `Bourbon Rosa`, process `washed`, finca `Bella Vista`, producer `Familia Plazas`, origin `Acevedo-Huila`, altitude `1750`, tasting notes including apple/mandarin/panela, and unknown roast.
- [x] Geisha Natural maps: variety `Geisha`, process `natural`, finca `Loma Verde`, producer `Esperanza Aguilar`, altitude `1200`, roast `medium-light`, legible tasting notes, and the printed El Salvador origin when OCR confidence is adequate.
- [x] Jaho maps the compact `MINAS - WASHED` identity to bean name `Minas` (not variety), origin `Brazil`, process `washed`, roast `medium`, and the three printed flavor descriptors.
- [x] Pacamara Natural maps: variety `Pacamara`, process `natural`, finca `Las Ventanas`, producer `Yobani Ochoa`, altitude `1450`, legible origin, notes, and unknown roast.
- [x] Pacas Natural maps: variety `Pacas`, process `natural`, finca `El Roble`, producer `Saúl Gutierrez`, altitude `1800`, legible origin, notes, and unknown roast.
- [x] SL28 Natural preserves its correct fields, appends `Santa Ana` to origin, preserves all four tasting notes, and keeps roast unknown for the unsupported word `Brew`.
- [x] `/analysis` displays the composed coffee name and each extracted origin/process/roast/altitude value in the correct control without swapping or silently defaulting fields.
- [x] Missing or genuinely unreadable values remain unknown/blank; weights, roast dates, marketing copy, and descriptive uses of words such as “natural” do not become coffee metadata.

## Approved implementation sequence

### 1. Lock in failing regression coverage

- [x] Create metadata-stripped fixture copies without altering the six files in `bags/`; keep enough resolution for real OCR and avoid committing GPS/camera metadata.
- [x] Replace the historical five-bag E2E expectations with the six-bag acceptance matrix and a repo-relative fixture directory.
- [x] Assert rendered Analysis controls plus the stored structured bean fields, not just navigation success.
- [x] Preserve assertions that OCR makes no `/api/extract-bean` or third-party request.
- [x] Run the harness before production edits and retain the expected field mismatches as the failing validation target.

### 2. Improve OCR transcription without broad guessing

- [x] Refactor image preparation to retain an oriented color source and create complementary OCR variants:
  - a resolution-normalized color pass,
  - the existing contrast grayscale pass,
  - upscaled color detail bands, which proved sufficient for the colored/stylized sample text without a separate threshold variant.
- [x] Upscale small photos/crops to an OCR-friendly working size while keeping a strict pixel/memory ceiling for large phone photos.
- [x] Preserve Tesseract line bounding boxes and pass provenance instead of flattening every layout block to text/confidence only.
- [x] Keep the automatic and sparse full-image passes, then run bounded, overlapping label-region fallbacks only when important fields remain missing.
- [x] Make crop selection work for both portrait and landscape bags rather than assuming the identity is in one portrait upper-middle strip.
- [x] Reuse one worker, report monotonic progress, honor aborts between passes, and always terminate the worker.

### 3. Map OCR text to fields using layout-aware deterministic rules

- [x] Associate a standalone label with the nearest plausible right/below value using geometry, confidence, and a bounded distance; do not require immediate array adjacency.
- [x] Collect multiline origin and tasting-note continuations until the next recognized label/section boundary.
- [x] Join split altitude number/unit tokens and permit a bare 300–3000 number only inside a tightly bounded altitude-label region.
- [x] Add confidence-gated fuzzy matching only for closed vocabularies (known process, variety, and roast aliases) so OCR artifacts such as curved `NATURAL` text can be corrected without matching prose.
- [x] Parse `name - recognized process` layouts as:
  - a known variety when the name is a variety alias,
  - otherwise `bean_name`, leaving variety unknown.
- [x] Recognize a producer line positioned between a parsed farm and the next labelled section when it is a high-confidence person-name candidate.
- [x] Prefer the strongest consistent candidate across passes and prevent a later weak/noisy pass from overwriting a stronger value.
- [x] Add false-positive tests for weights, dates, prose, unrelated country/marketing text, and unsupported roast wording.

### 4. Verify Analysis mapping

- [x] Confirm the existing initial Analysis bean/name derivation needs no helper change; the authenticated E2E flow exercises it directly.
- [x] Confirm `bean_name` remains available for product/lot identities such as Minas while variety/finca/producer compose the name for farm lots.
- [x] Keep `unknown` neutral for missing process/roast and preserve confidence badges.
- [x] Cover all six structured extraction shapes and rendered controls through the authenticated browser matrix.

### 5. Release hygiene and review

- [x] Bump `package.json` and `package-lock.json` from `2.0.3` to `2.0.4`.
- [x] Add a user-facing `CHANGELOG.md` entry describing more reliable local bag scanning and field mapping.
- [x] Re-run the six-bag E2E matrix until every acceptance row passes consistently in a fresh browser.
- [x] Run `review-recent-changes` immediately after implementation, using task-owned-file diffs because the source photos were already dirty at baseline.
- [x] Report findings and wait for approval before any review-fix batch.

## Commit-readiness checkpoint

- [x] After review has no unresolved findings, ask for explicit commit-readiness approval.
- [x] Only after approval, run:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e:ocr-ui`
- [x] If validation fails, report the failure and request approval before fixes, then return to implementation review. (Not triggered; all gates passed.)
- [x] When all gates pass, provide a concise Conventional Commit recommendation.

## Approved review-fix batch

- Ambient dirty files remain the six original user-owned photos under `bags/`; no new ambient files were observed.
- Task-owned files remain unchanged from the baseline list.
- [x] Require a real altitude unit boundary and bounded geometry/order when pairing split altitude tokens.
- [x] Apply confidence floors to fuzzy process recovery and inferred producer names.
- [x] Derive tasting-note confidence from matching note lines rather than unrelated high-confidence OCR text.
- [x] Replace the `Santa Ana`-specific origin continuation with a bounded cross-pass geometry rule.
- [x] Add focused regressions for each review finding.
- [x] Re-run release hygiene, focused tests, the six-bag browser matrix, and `review-recent-changes`.
