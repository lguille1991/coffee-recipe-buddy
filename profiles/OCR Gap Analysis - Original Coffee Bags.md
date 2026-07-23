# OCR Gap Analysis — Original Coffee Bags

Analysis date: 2026-07-23

## Method

1. Human reference profiles were transcribed visually from the six original files in `bags/`.
2. The app's browser OCR was run through the authenticated Scan → Analysis flow against those same original files.
3. The structured `ExtractionResponse.bean` values were captured before UI assertions.
4. Comparisons below distinguish wrong values, missing values, partial values, correct unknowns, and details the current Analysis schema does not represent.

This run intentionally used the originals rather than `tests/fixtures/coffee-bags/`.

## Summary

| Bag | Core OCR result | Material gaps |
|---|---|---|
| [Tropicália Bourbon Rosa](./Tropicalia%20-%20Bourbon%20Rosa%20Washed%20-%20Bella%20Vista.md) | Fails | Variety wrong; process missing; origin mapped from wrong grid cell; farm formatting wrong |
| [D'La Palma Geisha](./DLa%20Palma%20-%20Geisha%20Natural%20-%20Loma%20Verde.md) | Partial | Natural process missing; altitude missing; tasting notes fragmented |
| [Jaho Minas](./Jaho%20-%20Minas%20Washed%20-%20Brazil.md) | Passes core fields | Brand, seasonal label, and handwritten weight not represented |
| [D'La Palma Pacamara](./DLa%20Palma%20-%20Pacamara%20Natural%20-%20Las%20Ventanas.md) | Passes core fields | Origin truncated to country; fragrance and finish nuance dropped |
| [D'La Palma Pacas](./DLa%20Palma%20-%20Pacas%20Natural%20-%20El%20Roble.md) | Partial | Natural process missing; producer truncated; redundant orange note |
| [1200 Café SL28](./1200%20Cafe%20-%20SL28%20Natural%20-%20La%20Divina.md) | Passes core fields | Brand, drying, format, weight, and country seal not represented |

## Highest-Priority OCR Gaps

### 1. Original images and sanitized fixtures do not behave equivalently

The current six-fixture E2E matrix passes, but three corresponding originals fail or degrade:

- Bourbon Rosa: major field and grid-association errors.
- Geisha: process and altitude disappear; notes become noisy.
- Pacas: process disappears and producer truncates.

The fixture-generation resize/compression is therefore improving OCR in a way that masks production behavior. Future regression coverage should exercise the original-resolution inputs or reproduce their resolution characteristics without retaining private EXIF.

### 2. Curved orange `NATURAL` text remains unreliable

Both original D'La Palma bags with curved orange `NATURAL` text fail process extraction:

- Geisha Natural
- Pacas Natural

Pacamara Natural succeeds because its original produces a stronger recognition result.

### 3. Table/grid association remains fragile

On the Bourbon label:

- `CAFICULTORA` is mapped as the origin.
- `ACEVEDO-HUILA` is lost.
- `BOURBON ROSA` becomes `Se a`.
- `LAVADO` is not recovered.

This indicates the fallback needs column-aware geometry using both label and value rows, with candidate validation before committing a field.

### 4. Split tokens need better cross-pass reconciliation

- Geisha: `1200` is not joined with `msnm / masl`.
- Geisha: `Higo` becomes `Hi` + `igo`.
- Pacas: `Saúl Gutierrez` truncates to `Saúl`.

Exact or near-overlapping fragments from different passes should be reconciled before parsing.

### 5. Note normalization loses nuance or adds redundancy

- Geisha preserves noisy fragments instead of a clean canonical list.
- Pacas emits both `naranja dulce` and redundant `naranja`.
- Pacamara and Pacas drop printed fragrance and creamy-finish descriptors.

The parser should prefer the longest recognized tasting-note phrase and avoid emitting a shorter note fully contained within it.

### 6. Several printed details are outside the current mapped profile

Across the corpus, local OCR does not retain:

- Roaster / brand
- Bag weight and format
- Roast date when present
- Drying method
- Edition / seasonal lot label
- Fragrance, aftertaste, and body descriptors as separate concepts

These are schema/product decisions rather than transcription failures. They should be separated from core OCR defects when planning the next implementation batch.

## Recommended Next Regression Matrix

| Layer | Required input |
|---|---|
| Human reference | These six Markdown profiles |
| Production-like OCR | Metadata-stripped copies that preserve original pixel dimensions and orientation |
| Optimized OCR | Existing resized sanitized fixtures |
| Comparison | Per-field exact/partial/missing/wrong classification |
| UI | Rendered `/analysis` controls plus stored structured extraction |

The next OCR change should not be accepted unless both production-like originals and optimized fixtures meet the core-field expectations.

