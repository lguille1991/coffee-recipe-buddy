# Deterministic, AI-Independent Brewing Engine

## Baseline metadata

- Pre-existing dirty files at the original plan baseline: none.
- Current ambient dirty files: none.
- Task-owned files: `.claude/plans/deterministic-recipe-engine-plan-2026-07-22.md`, `src/types/recipe.ts`, `src/types/coffee-profile.ts`, `src/lib/recipe-migrations.ts`, `src/lib/deterministic-recipe-engine.ts`, `src/lib/recipe-generation.ts`, `src/lib/deterministic-ocr-parser.ts`, `src/lib/browser-ocr.ts`, `src/lib/__tests__/deterministic-ocr-parser.test.ts`, `src/lib/__tests__/browser-ocr.test.ts`, `src/lib/__tests__/deterministic-recipe-engine.test.ts`, `src/app/scan/page.tsx`, `src/app/scan/page.test.tsx`, `src/app/analysis/page.tsx`, `src/app/analysis/page.test.tsx`, `src/app/api/extract-bean/route.ts`, `src/app/api/extract-bean/route.test.ts`, `src/app/api/generate-recipe/route.ts`, `src/app/api/generate-recipe/route.integration.test.ts`, `src/app/api/recipes/from-profile/route.ts`, `public/ocr/v7/`, `docs/ocr-assets.md`, `next.config.ts`, `eslint.config.mjs`, `README.md`, `.env.example`, `package.json`, `package-lock.json`, and `CHANGELOG.md`.
- Refresh the task-owned file list and newly observed ambient dirty files before implementation begins and after every approved rework batch.
- Approved rework batch (2026-07-22): no newly observed ambient dirty files; task-owned files include `src/app/api/generate-recipe/route.integration.test.ts`.
- Approved OCR-parser review rework (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved browser-OCR review rework (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved browser-OCR validation rework (2026-07-22): no newly observed ambient dirty files; `eslint.config.mjs` added to task-owned files.
- Approved browser-OCR relaxed-SIMD rework (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved bag-layout OCR rework (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved coffee-bag parser calibration batch (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved compact-identity false-positive rework (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Approved standalone label-value calibration batch (2026-07-22): no newly observed ambient dirty files; task-owned files unchanged.
- Baseline runtime: Node `22.4.0`, npm `10.8.1`.
- Baseline validation: `npm test` reports 245 passing tests but exits nonzero because eight jsdom workers hit a pre-existing `ERR_REQUIRE_ESM` dependency error. A completely green test run is a hard deployment requirement; this failure may not be waived for production.
- Security prerequisite: rotate the live-looking OpenRouter credential exposed from the ignored `.env.local` file during plan review. Never commit or reproduce the credential in code, documentation, fixtures, logs, or test output.

## Current implementation batch (2026-07-22)

- [x] Define a typed local-OCR result contract and implement a pure English/Spanish label-only parser with documented normalization, token-derived confidence, and partial/empty results.
- [x] Keep unknown roast neutral and selectable in Coffee Analysis, including a visible low-confidence score of zero.
- [x] Add focused parser and analysis coverage before integrating the browser OCR worker in the next batch.
- [x] Commit-readiness validation passed: `npm test` (55 files, 280 tests), `npm run lint`, and `npm run build`.

## Browser OCR implementation batch (2026-07-22)

- [x] Add pinned, same-origin Tesseract.js v7 worker/core/language assets with documented checksums and cache policy.
- [x] Add an event-triggered browser OCR helper that preprocesses a separate grayscale image, dynamically imports Tesseract, reports progress, and always terminates its worker.
- [x] Replace scan-page extraction fetches with local OCR, preserve the compressed color image for optional profile saving, and reject stale scan results.
- [x] Delete `/api/extract-bean` and its tests; add coverage proving the scan flow makes no extraction request.
- [x] Commit-readiness validation passed: `npm test` (56 files, 285 tests), `npm run lint`, and `npm run build`.
- [x] Relaxed-SIMD asset validation passed: `npm test` (56 files, 286 tests), `npm run lint`, and `npm run build`.

## Coffee-bag parser calibration batch (proposed 2026-07-22)

- [x] Add deterministic text fixtures derived from the supplied Tropicália, Crafters, Jaho, D’La Palma, and 1200 Café bag layouts; fixtures contain only label/value text, never image data.
- [x] Extend documented English/Spanish labels and compact label/value forms for process, variety, farm, producer, origin/region, altitude, roast, and tasting notes.
- [x] Recognize a documented compact variety/process pair (for example, `Geisha Natural`, `Pacamara Semilavado`, and `Bourbon Rosa Lavado`) as structured coffee identity, splitting only exact recognized variety and process tokens.
- [x] When a compact layout contains an exact recognized process token but its neighboring text is ambiguous (for example, `Minas - Washed`), populate only `process: washed`; do not guess whether `Minas` is a variety, origin, or bean name.
- [x] Keep other unlabelled display/marketing text neutral; only parse a value when an adjacent supported label or a documented compact layout establishes its field.
- [x] Verify per-field confidence, partial results, false-positive resistance, and the original bag-layout regression fixture.
- [x] Commit-readiness validation passed: `npm test` (56 files, 291 tests), `npm run lint`, and `npm run build`.

## Standalone label-value calibration batch (proposed 2026-07-22)

- [ ] Recognize standalone altitude values only when they include an explicit altitude unit (`m`, `masl`, or `msnm`), so weights and other bare numbers remain untouched.
- [ ] Recognize exact standalone English/Spanish roast phrases such as `Medium Light` and `Medio Claro` without treating descriptive prose as roast data.
- [ ] Add a D’La Palma Geisha Natural text fixture covering split OCR lines for altitude, roast, variety, process, farm, and producer.
- [ ] Verify that all captured fields flow through Coffee Analysis and that unknown fields remain neutral.

## Session implementation status (2026-07-22)

The parent checklist items below remain open unless they are fully complete. This session completed the deterministic recipe-generation foundation and its commit-readiness validation; browser OCR, deterministic Auto Adjust, removal of the remaining AI routes, documentation, and production acceptance work are still outstanding.

- [x] Added `src/lib/deterministic-recipe-engine.ts`: a pure deterministic generator with a deep-frozen, typed v2.0.0 catalog for all nine methods; exact integer water allocation; V60-only 4:6 mode; capacity/mode/input errors; UTC evaluation-date and roast-date validation; deterministic templates; and ordered generation provenance.
- [x] Replaced model-backed runtime generation in `/api/generate-recipe` and `/api/recipes/from-profile` with the deterministic engine. The routes preserve their URLs and success envelopes, derive the evaluation date server-side, default legacy direct callers to the `balanced` Goal, return stable error codes, and no longer create OpenRouter clients or tracking cookies.
- [x] Made profile idempotency keys include catalog version, UTC evaluation date, normalized bean data/profile revision, Goal, method, exact target water, and recipe mode. Removed the profile route's `Math.max(50, ...)` water clamp.
- [x] Added additive `generation_metadata`, bumped saved-recipe schema version to 7, added a v6 → v7 preservation-only migration, and introduced `unknown` as the neutral parsed roast state.
- [x] Bumped the application version from 1.25.0 to 2.0.0 and added a user-facing changelog entry for deterministic generation.
- [x] Added focused deterministic-engine and route coverage. Final validation passed: `npm test` (54 files, 276 tests), `npm run lint`, and `npm run build`.
- [ ] Still in scope: all remaining unchecked parent items below, including source-ledger/recommendation recalibration, expanded compatibility and boundary testing, OCR, Auto Adjust, residual OpenRouter removal, documentation, physical brewing, preview rollback, and launch gates.

## Summary and non-negotiable behavior

Replace every runtime OpenRouter/model dependency with:

- A versioned deterministic recipe engine for all nine brewers.
- Browser-side, self-hosted English/Spanish OCR for bag scanning.
- Structured deterministic Auto Adjust choices.
- Existing routes, saved recipes, manual authoring, sharing, cloning, snapshots, and visible recipe layouts preserved unless this plan explicitly describes a breaking API removal.

“AI-independent” means no hosted or generative AI at runtime. Local OCR remains permitted. Historical recipe JSON is never regenerated or rewritten in the database merely because it is read.

Canonical units and compatibility rules:

- The engine uses integer grams for target water and Water Additions. Existing UI/API names containing `ml` remain compatibility boundaries and use the app's existing 1 ml ≈ 1 g convention.
- Existing recipe response envelopes remain unchanged. `generation_metadata` is an additive optional recipe field.
- `/api/extract-bean` is removed in v2. Scanning must not call a replacement extraction endpoint; OCR runs in the browser.
- `/api/generate-recipe` continues supporting authenticated and guest generation without a tracking identifier or guest-tracking cookie.

## Engine architecture and rules

- [x] Refresh baseline metadata and task-owned files before editing implementation code.
- [ ] Add a typed, immutable, versioned Rule Catalog and pure `generateDeterministicRecipe` orchestration.
  - [x] Session implementation: the v2.0.0 catalog and pure generator are in place; the catalog is recursively frozen and generation rejects unknown engine versions.
  - Inputs: `MethodId`, normalized bean profile, Goal, integer target water grams, recipe mode, explicit evaluation date, and engine version.
  - The pure engine never calls `Date.now()`, reads environment variables, performs I/O, or accepts a client/model/tracking argument.
  - Production routes derive one canonical `YYYY-MM-DD` evaluation date in UTC and pass it to the engine. Clients cannot submit or override it. Tests may call the pure engine with a fixed date.
  - Validate that evaluation and roast dates are real calendar dates. Define future roast dates as invalid input rather than silently treating them as fresh.
  - Keep old Rule Catalog versions available for golden tests and provenance lookup, or treat historical rule IDs as opaque if a catalog version is retired.
- [ ] Make rule precedence executable rather than descriptive.
  - Hard constraints: supported method, brewer capacity, recipe-mode compatibility, temperature/ratio/grind safety, and valid step structure.
  - Ranked soft signals: Goal → process → variety → roast → freshness → altitude/origin → tasting notes.
  - Define exact weights, override rules, stable tie-breaking order, and neutral behavior for absent or unknown signals.
  - Process and variety are the primary bean-derived signals; Goal may deliberately outrank them because it expresses user intent.
  - Store source URL/title, accessed date, extracted recommendation, and conflict resolution for every externally derived rule. Prefer official brewer/recipe-creator guidance, then credible brewing research, then existing project references.
- [ ] Recalibrate recommendations, grind, temperature, timing, and pour rules as engine v2.
  - [x] Session implementation: all nine methods now have deterministic capacity, filter, ratio, temperature, grind, timing, pour-rate, and template defaults; V60 4:6 is V60-only and scales to requested water.
  - Each brewer defines min/max water capacity, filter, base ratio/temperature/grind, internal typed step templates, total-time bands, and pour-rate bands.
  - Pass target water into method recommendation. Exclude or visibly mark brewers that cannot safely handle it so a top recommendation cannot fail immediately after selection.
  - Keep grinder conversion for all five supported grinders and enforce method-specific ranges.
  - Preserve V60 4:6, restrict it to V60, scale it to exact target water, use Goal-sensitive first-40% splits, numeric pour speeds, near-drain timing, and the 3:30–4:00 guardrail.
- [ ] Generate exact, internally structured recipe steps and map them to the existing `RecipeStep` response shape.
  - [x] Session implementation: deterministic recipes use exact integer Water Additions, a final zero-water Brew Step, canonical pour-rate action text, capacity bounds, and whole-gram coffee doses.
  - Internal Water Addition steps have integer `water_poured_g > 0`; internal non-water Brew Steps have `water_poured_g === 0`.
  - Maintain numeric internal start/end timestamps and render the existing `time` string from them so chronological validation does not depend on parsing prose.
  - Allocate integer Water Additions with a constrained largest-remainder strategy. The allocator must preserve the target total, template intent, minimum positive additions, and pour-rate bands; do not blindly place all remainder in the final pour when that violates a constraint.
  - Reject unsupported target water with a stable error code and actionable min/max bounds. Remove the current profile-route `Math.max(50, ...)` clamp; never clamp or silently modify target water.
  - Keep water exact, round generated coffee to whole grams, and report the resulting actual ratio consistently in numeric calculations and display text.
  - Compute pour duration and `g/s` from structured values, then render canonical action text such as `Pour 80g over 25s (~3.2g/s)` without changing the visible step-card layout.
  - Generate display name, objective, instructions, and quick-adjustment copy from deterministic templates.

## Schema, provenance, and historical compatibility

- [ ] Add optional `generation_metadata` to `RecipeSchema`.
  - [x] Session implementation: additive metadata fields exist and deterministic generation writes engine version, UTC evaluation date, and ordered unique rule IDs.
  - `engine_version`: a catalog-backed version identifier.
  - `evaluation_date`: a validated real `YYYY-MM-DD` date.
  - `applied_rule_ids`: ordered and unique; every ID must belong to the declared engine version when that catalog remains available.
  - Metadata describes the original deterministic generation, not every later edit. Scaling and Auto Adjust preserve it unchanged; adjustment/edit history records later transformations.
  - Manual recipes omit generation metadata. Clones, shares, snapshots, session recovery, save-as-new, replace, and manual edits preserve it when present.
- [ ] Bump `CURRENT_SCHEMA_VERSION` from 6 to 7 for new saved recipes.
  - [x] Session implementation: `CURRENT_SCHEMA_VERSION` is 7 and migration 6 → 7 preserves the existing JSON unchanged.
  - Add an explicit v6→v7 preservation-only migration/no-op. Do not synthesize metadata for historical recipes or rewrite stored rows.
  - Existing recipes without metadata must remain valid in every read, edit, share, clone, restore, and Auto Adjust path.
  - Verify rollback compatibility: the previous production build must at minimum render recipes containing the additive field without crashing. Document that edits made by an old build may strip unknown metadata if that cannot be prevented.
- [ ] Replace accidental “medium roast” inference with genuinely neutral missing data.
  - [x] Session implementation: parsed/missing roast values now normalize to `unknown`; Analysis UI support and full neutral-recommendation verification remain open.
  - Add an explicit `unknown` roast state or carry provenance that prevents an unconfirmed medium default from affecting recommendations and engine rules. Prefer the explicit `unknown` state.
  - Allow the Analysis screen to show and edit Unknown without changing its overall layout.
  - Keep process `unknown`, optional variety/notes/origin/altitude, and reduced recommendation confidence neutral until the user confirms values.
- [ ] Preserve historical manual-recipe detection.
  - Update new manual recipe copy to remove “without AI guidance.”
  - Keep a stable structural manual-origin marker such as `range_logic.base_range === 'Manual recipe'` and continue recognizing the historical objective string.

## Generation routes and persistence

- [ ] Keep `/api/generate-recipe` and `/api/recipes/from-profile` URLs and success response envelopes.
  - [x] Session implementation: both generation routes now invoke the deterministic engine, validate canonical request inputs, preserve their response envelopes, and return stable generation errors without OpenRouter/model behavior.
  - Define dedicated Zod request schemas using `MethodIdSchema`, integer target water, recipe mode, and optional Goal defaulting to `balanced` for legacy callers.
  - Update the direct method-selection request to send Goal; the saved-profile path already sends it.
  - Preserve guest and authenticated behavior, profile saving, snapshot creation, Goal persistence, and the existing 201-created/200-idempotent-replay statuses.
  - Remove OpenRouter clients, model/tracking arguments, retry logic, debug parity environment behavior, and model-specific errors.
  - Return stable machine-readable codes for invalid input, unsupported method/mode, capacity bounds, and deterministic invariant failures, with tested HTTP statuses and safe user messages.
- [ ] Make profile idempotency version- and date-aware.
  - [x] Session implementation: the idempotency key includes catalog version, evaluation date, profile revision/normalized bean, Goal, method, target water, and mode.
  - Include engine version, UTC evaluation date, normalized bean input or profile revision, Goal, method, exact target water, and recipe mode in the key.
  - Verify concurrent duplicates produce one saved recipe and one snapshot chain.
  - Verify a new evaluation date or engine version does not replay an older result.
- [ ] Keep Goal and generation provenance consistent across save paths.
  - [x] Session implementation: profile saves persist Goal in `generation_context`, and the same deterministic recipe—including metadata—is used for both original and current recipe JSON.
  - Persist Goal in `generation_context` for direct saves and from-profile saves.
  - Preserve generation metadata independently in both `original_recipe_json` and `current_recipe_json`.
  - Do not encode Goal only as an objective suffix; objective text may display it, but structured data is authoritative.

## Browser OCR and scan flow

- [ ] Remove `src/app/api/extract-bean/route.ts` and its model-specific route tests. Remove the scan-page fetch to `/api/extract-bean`; an end-to-end test must prove no extraction request occurs.
- [ ] Add browser-side Tesseract.js v7 behind an event-triggered dynamic import after image selection.
  - Self-host a pinned worker script, all core variants required for automatic WASM/SIMD/LSTM selection, and pinned `eng`/`spa` traineddata.
  - Configure explicit same-origin `workerPath`, core-directory `corePath`, and `langPath`; define Blob-worker/CSP behavior deliberately rather than relying on defaults.
  - Add correct MIME types, versioned asset paths, integrity/checksum documentation, and long-lived immutable caching headers. Next's default `public` asset cache behavior is not sufficient for large OCR assets.
  - Record licenses and required attribution for Tesseract, core files, and traineddata.
  - Create one worker per scan, expose progress through an accessible `aria-live` status, and always terminate in `finally` after success, failure, cancellation, reselection, or navigation.
  - Guard against stale results when the user rapidly selects another image; only the latest scan may update storage or navigate.
- [ ] Separate photo storage preparation from OCR preprocessing.
  - Preserve the color compressed photo for optional profile storage.
  - Create a separate normalized grayscale/high-contrast OCR canvas with correct EXIF orientation and sufficient resolution.
  - Validate MIME/type and decode success; give actionable errors for corrupt/unsupported formats, including HEIC behavior on unsupported browsers.
  - Handle session/local-storage quota or privacy-mode failures without losing a successful OCR result. Do not claim the photo never leaves the device: it is uploaded to Supabase when the user saves a profile with its image.
- [ ] Add a pure, deterministic OCR parser.
  - Parse only explicit labels and documented English/Spanish aliases; do not infer process, roast, or variety from unrelated prose.
  - Define normalization for accents, punctuation, line breaks, multi-value varieties/notes, altitude units/ranges, and label/value proximity.
  - Derive each field confidence from the exact matched OCR tokens/blocks and document the aggregation rule.
  - Fix confidence display so a score of `0` is shown as low confidence rather than treated as absent.
- [ ] Extend the client-side extraction result with typed `status`/`warnings` sufficient for partial and empty OCR.
  - Empty OCR proceeds to Coffee Analysis with `process: unknown`, neutral roast state, reduced confidence, and a visible warning.
  - Partial OCR populates only supported explicit fields; the user can confirm or correct all values.
  - Preserve the Scan and Coffee Analysis layouts while updating progress, warning, privacy, and error copy.

## Deterministic Auto Adjust

- [ ] Replace the free-text textarea with an accessible single-choice control for the existing symptoms: acidic, bitter, flat/lifeless, slow drain, and fast drain.
  - Keep scaling, preview, regenerate, save-as-new, replace, unsaved-navigation protection, and preferred-grinder display.
  - Use radio/selection semantics, full keyboard support, visible focus, and accessible errors/progress.
- [ ] Change the endpoint contract to `{ scale_factor, symptom? }` using `SymptomSchema`; reject 1× without a symptom.
- [ ] Extract one shared pure `scaleRecipeDeterministically` function and apply it before `applyFeedbackAdjustment`.
  - Validate the scaled result against brewer capacity; never clamp it.
  - Define scaled coffee rounding explicitly: generated recipes return to whole grams, while historical/manual decimal doses may preserve one decimal if required for backward compatibility.
  - Reallocate steps exactly, recompute accumulation, ratio, action gram mentions, pour durations/rates, and any affected total-time guidance.
  - Recalculate all five grinder starting points within method ranges using the existing scale-offset policy.
  - Preserve original generation metadata and add the symptom/scale transformation to existing adjustment and snapshot history.
  - Run the full deterministic invariant validator after scaling and again after symptom adjustment.

## Removal, documentation, and release hygiene

- [ ] Remove OpenRouter clients, model selection, prompt builders, guest-user tracking, model-specific tests, debug parity variables, OpenRouter environment variables, and the `openai` dependency.
  - [x] Session implementation: OpenRouter/model behavior was removed from the two recipe-generation routes only.
  - [ ] Remaining: scanning and Auto Adjust still use OpenRouter; the dependency, shared client, model configuration, prompt builder, cookie cleanup, and environment/docs cleanup are not yet done.
  - Expire the legacy `crp_openrouter_guest_id` cookie once for returning users; deleting server code alone does not clear existing browser cookies.
  - Remove OpenRouter secrets from local/deployment configuration after rotation and confirm the production build starts with no OpenRouter variables.
  - Audit source, lockfile, built server chunks, and browser network activity for residual OpenRouter/OpenAI code or requests.
- [ ] Add `tesseract.js`, pinned OCR assets, checksums/licenses, asset headers, and lockfile updates. Ensure OCR code and assets are not requested from non-scan routes.
- [ ] Update `CONTEXT.md` with canonical terms: **AI-Independent**, **Deterministic Recipe Engine**, **Rule Catalog**, **Evaluation Date**, **Water Addition**, **Brew Step**, and **Rule Trace**.
- [ ] Add one concise ADR recording the hard-to-reverse choice of versioned deterministic rules plus local OCR instead of runtime generative AI.
- [ ] Update README deployment/API instructions, privacy wording, supported browser behavior, brewing-rule documentation/source ledger, and `CHANGELOG.md`.
- [ ] Pin one supported Node version consistently in local tooling, CI, and deployment (`engines` plus `.nvmrc` or the repository-standard equivalent) after resolving the jsdom failure.
- [ ] Bump the app from `1.25.0` to `2.0.0` because `/api/extract-bean` is removed and the Auto Adjust request contract changes.
  - [x] Session implementation: the app version is now 2.0.0. The stated extraction/Auto Adjust breaking changes are still pending.

## Automated test plan

- [ ] Create version-keyed golden fixtures for every brewer at nominal volume, fixed evaluation date, and representative Goals/bean profiles. Require intentional fixture review for every engine-version change.
- [ ] Add a bounded pairwise/boundary matrix rather than an unbounded Cartesian product:
  - Every brewer at min, min+1, nominal, max-1, max, and rejected out-of-range water.
  - Every Goal, process, roast including unknown, recognized variety family, missing-data profile, and freshness boundary represented across the matrix.
  - Leap day, UTC date boundary, invalid/future roast date, and exact freshness threshold cases.
- [ ] Property-test engine invariants.
  - Identical normalized inputs/date/version produce byte-equivalent JSON.
  - Water Addition values are positive integers; Brew Step additions are zero.
  - Exact water sum and accumulation; sequential step numbers; monotonic numeric timestamps; final time within method bounds.
  - Ratio matches rounded coffee and exact water; temperature/grind/capacity/schema bounds hold.
  - Pour duration and action `g/s` agree numerically and remain inside brewer bands.
  - Applied rule IDs are stable, ordered, unique, and valid for the engine version.
- [ ] Test V60 4:6 scaling, every Goal split, non-V60 rejection, constrained rounding, near-drain timing, and 3:30–4:00 guardrails.
- [ ] Test recommendation capacity filtering, ordering, exact weight/precedence behavior, stable tie-breaking, neutral missing signals, and confidence reduction.
- [ ] Unit-test OCR parsing with English/Spanish text/block fixtures, accents, aliases, multiline labels, false positives, mixed confidence, zero confidence, partial results, and empty OCR.
- [ ] Component-test OCR progress, `aria-live` behavior, stale-result protection, cancellation, worker cleanup on every exit path, storage quota failure, empty-result warning, user corrections, and navigation to Analysis.
- [ ] Route-test both generation paths with OpenRouter absent.
  - [x] Session implementation: direct and profile generation route tests cover deterministic behavior, legacy Goal defaulting, capacity/mode errors, metadata, profile persistence, and idempotent replay basics.
  - Guest/authenticated direct generation, legacy Goal default, invalid Goal/method/date/volume, every capacity boundary, stable error codes, and additive metadata.
  - Profile idempotency under concurrency, date/version key changes, one snapshot chain, Goal persistence, and no silent delta clamp.
- [ ] Test every allowed scale factor alone and every scale/symptom combination against generated, historical, manually authored, minimum-capacity, and maximum-capacity recipes.
  - Assert exact totals, synchronized action text/rates/times, capacity rejection, grinder bounds, immutable generation provenance, adjustment history, save-as-new, replace, and snapshot behavior.
- [ ] Test recipes without generation metadata and schema versions 1–6 across session recovery, list/detail, edit, share, clone, restore, snapshot history, and Auto Adjust.
- [ ] Test historical and new manual-recipe detection independently.

## Production and physical acceptance

- [ ] Resolve the jsdom/Node failure first, then establish a clean green baseline on the pinned runtime. Passing tests may not be inferred from a partial worker run.
- [ ] From a clean checkout run, in repository workflow order: `review-recent-changes`, report findings and wait for approval, then `npm test`, `npm run lint`, and `npm run build` after commit-readiness approval.
  - [x] Session implementation: review/rework loops completed and the final working tree passed `npm test`, `npm run lint`, and `npm run build`; a clean-checkout run remains to be performed.
- [ ] Run production-mode browser tests against `next build` + `next start`, not only jsdom/dev mode.
  - Verify actual worker/core/language asset requests, MIME/cache/CSP behavior, no third-party OCR request, no extraction endpoint call, and no OCR bundle/asset request on non-scan routes.
  - Cover authenticated and guest generation plus scan → analysis → recommendation → recipe → save → detail → share/clone → Auto Adjust.
- [ ] Test supported iOS Safari and Android Chrome devices, including camera orientation, slow first-load, IndexedDB/private mode, offline asset failure, repeated-scan caching, cancellation, and low-memory behavior.
- [ ] Define and enforce budgets for scan-route JS, first OCR asset download, warm scan duration, peak memory, and non-scan bundle regression.
- [ ] Create an expert-approved recipe corpus and physically brew every brewer at minimum, nominal, and maximum capacity before production.
  - Record safety/usability issues, drawdown and total-time feasibility, cup result, and any accepted rule recalibration.
  - Include at least washed, natural/experimental, light, dark, very fresh, old, unknown-data, and Goal-sensitive examples across the corpus.
- [ ] Verify deployment/rollback compatibility in a preview environment.
  - New build reads all historical recipes without mutation.
  - Previous build can render a newly generated recipe with optional metadata.
  - Rolling back does not require a destructive database migration.
- [ ] Stage rollout and monitor privacy-safe metrics by engine version: generation success/failure code, capacity rejection rate, OCR empty/partial rate, OCR duration/failure, Auto Adjust invariant failure, and save completion. Do not log bag images, OCR text, tasting notes, bean names, or other user-entered profile content.
- [ ] Production launch gate: rotated credential, no OpenRouter deployment secrets, green tests/lint/build/E2E, completed physical brew sign-off, asset/license audit, acceptable performance budgets, preview rollback check, and no blocking review findings.

## Five-bag browser OCR verification and calibration batch (proposed 2026-07-22)

- [x] Establish a repeatable browser-engine scan matrix using at least five supplied bag photos that cover D'La Palma split identity labels, a structured label grid, English-only label text, Spanish-only label text, and a dark/high-contrast package.
- [x] For each scan, record the raw OCR field result and the Coffee Analysis field mapping, then compare only explicit package facts: variety, process, altitude, roast, farm, producer, origin/region, and tasting notes when visibly labelled.
- [x] Classify every mismatch as OCR transcription, deterministic parser mapping, or Scan-to-Analysis persistence/rendering, and add focused regression coverage for any parser or UI mapping defect.
- [x] Apply the smallest privacy-preserving calibration changes needed to make the representative matrix reliable; preserve the rule that unlabeled marketing text and ambiguous values remain unknown.
- [x] Run the required review loop after each approved fix batch, then re-run the full five-bag matrix until all explicitly supported fields map correctly or a documented OCR limitation prevents deterministic extraction.
- [x] Commit-readiness validation passed: `npm test` (56 files, 301 tests), `npm run lint`, and `npm run build`.

### Five-bag evidence (2026-07-22)

- D'La Palma Geisha Natural: automatic plus sparse OCR read `Medium Light` and `Finca Loma Verde`; the portrait identity-strip pass read `Geisha`. The highly stylized `Natural` word and unit after `1200` were not transcribed reliably, so those fields remain neutral rather than guessed.
- Tropicália Bourbon Rosa Lavado: OCR read `BOURBON ROSA` and `LAVADO`; parser maps these to `variety: Bourbon Rosa` and `process: washed`.
- Jaho Minas Washed: OCR read `MINAS`, `WASHED`, and `MEDIUM ROAST`; parser maps only the explicit process and roast, leaving `Minas` neutral rather than treating it as a variety or origin.
- D'La Palma Pacamara Yellow Honey: complementary passes read `Finca Machuca`, `Pacamara`, and `YELLOW HONEY`; parser maps farm, variety, and honey process.
- 1200 Café Kenya SL28: OCR read the labelled process, farm, producer, region, altitude, and profile fields; parser maps those labelled values. `Tueste: Brew` correctly remains unknown because Brew is not a roast level.
- The authenticated browser UI could not be opened from the clean automation browser session; the same parser-to-Coffee Analysis mapping is covered by five focused component cases. Manual authenticated scan verification remains useful for the exact device/browser photo pipeline.
- Approved review rework (2026-07-22): normalize OCR de-duplication with locale-independent `toLowerCase()`; no newly observed ambient dirty files.

## Test-only authenticated OCR UI harness (proposed 2026-07-23)

### Baseline metadata

- Pre-existing dirty files: `.claude/plans/deterministic-recipe-engine-plan-2026-07-22.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `src/app/analysis/page.test.tsx`, `src/lib/__tests__/browser-ocr.test.ts`, `src/lib/__tests__/deterministic-ocr-parser.test.ts`, `src/lib/browser-ocr.ts`, and `src/lib/deterministic-ocr-parser.ts`; all belong to the preceding OCR calibration batch.
- Task-owned files: `src/components/AuthContext.tsx`, `src/lib/e2e-test-auth.ts`, `src/lib/__tests__/e2e-test-auth.test.ts`, `scripts/e2e-ocr-ui.mjs`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, `package-lock.json`, `CHANGELOG.md`, and this plan. Existing dirty calibration files remain owned by the preceding batch and will not be reverted.

- [x] Add a client-only test identity that activates only when an explicit public E2E flag is set and the app is not running in production; it bypasses neither server/API authorization nor Supabase in ordinary sessions.
- [x] Keep the existing Supabase auth lifecycle intact when the flag is absent, and add focused tests proving production/flag-off behavior cannot enable the test identity.
- [x] Launch a fresh local app instance with the E2E flag, upload at least five supplied bag photos through the real Scan UI, wait for local Tesseract, and record the resulting Coffee Analysis controls.
- [x] Assert no scan request reaches the removed extraction endpoint or a third-party OCR host; the harness explicitly rejects `/api/extract-bean`, and OCR worker/core/language requests remain same-origin under `/ocr/v7`.
- [x] Classify UI-matrix mismatches and add the smallest source-supported calibration regression: a narrow portrait variety pass plus the observed `acámara` → `Pacamara` OCR correction. Neutral fields remain neutral when OCR does not transcribe them.
- [x] Apply required release hygiene for user-facing runtime code, then run the required review loop and wait for commit-readiness confirmation before full validation.

### E2E evidence (2026-07-23)

- `npm run test:e2e:ocr-ui` starts an isolated Webpack local app server at port 3001 with test auth enabled, then drives the real Scan → Analysis route with Playwright and the browser-side Tesseract worker.
- The final five-image pass asserted: Geisha/Loma Verde with medium-light roast; Bourbon Rosa with washed process; Jaho Minas with washed process and medium roast; Pacamara/Machuca with honey process and 1850 masl; and SL28/La Divina/Roberto Ulloa with natural process and 1550 masl.
- The harness rejects any non-local browser request, so it would fail if a removed extraction endpoint or a third-party OCR host were contacted.

## Webpack development-server fallback (proposed 2026-07-23)

### Baseline metadata

- Pre-existing dirty files: generated `.next-recovery-20260723/`, created while preserving a corrupted Turbopack cache; it is not task-owned application source.
- Task-owned files: `.gitignore`, `package.json`, `package-lock.json`, `CHANGELOG.md`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `scripts/e2e-ocr-ui.mjs`, and this plan.

- [x] Make Webpack the default `npm run dev` bundler to avoid the reproducible Turbopack/PostCSS corruption of generated CSS while keeping production builds unchanged; ordinary development uses an isolated `.next-dev` cache and OCR E2E retains `.next-e2e`.
- [x] Keep the local OCR E2E harness aligned with the default dev command, including its isolated port and build output.
- [x] Add patch release hygiene and validate a fresh Webpack dev server serves `/scan` without CSS parsing errors (`npm run dev -- --port 3000`; `GET /scan` returned HTTP 200).
- [x] Run the required review loop and wait for commit-readiness confirmation before full validation.

- Approved validation rework (2026-07-23): exclude generated development-cache recovery directories from ESLint after they caused generated-code findings; source linting remains unchanged.
