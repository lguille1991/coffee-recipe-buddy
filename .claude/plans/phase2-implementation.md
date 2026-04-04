# Phase 2 — Post-Brew Feedback + Manual Bean Entry

Source spec: `phase2_feedback_block9_manual_fallback.md`

---

## 1. Home Screen

- [x] Add "Enter Manually" secondary CTA alongside "Scan Your Coffee" on the home screen

---

## 2. Manual Bean Entry Form (`/manual`)

- [x] Create `/manual` route and page
- [x] Form fields: roaster name (opt), bean name (opt), origin (opt), variety (picker + freeform, opt), **process** (required picker: washed / natural / honey / anaerobic / other), **roast level** (required picker: light / medium / medium-dark / dark), altitude in masl (opt), tasting notes (tag input, opt), roast date (opt)
- [x] Client-side validation — block submission without process + roast level
- [x] On submit, construct a `BeanProfile` from form data; missing fields default per spec:
  - Freshness defaults to optimal (8–21 days)
  - Skip Block 5 (density fine-tune) when altitude is absent
  - Annotate `range_logic` assumptions for any missing fields
- [x] Navigate to `/methods` via same method-decision-engine path as the image flow

---

## 3. Feedback Adjustment Engine (`src/lib/adjustment-engine.ts`)

- [x] Define `Symptom` union type: `too_acidic | too_bitter | flat_lifeless | slow_drain | fast_drain`
- [x] Implement symptom → primary/secondary adjustment mapping (Block 9 table)
- [x] Read `range_logic.final_operating_range` and current grind from recipe
- [x] Apply directional grind adjustment (1–2 K-Ultra clicks toward fine/coarse end), clamped within operating range
- [x] Escalate to secondary adjustment when primary variable is already at range edge
- [x] Temperature adjustments: ±1 °C per round, clamped within offset-adjusted bounds
- [x] Ratio adjustments (flat/lifeless): move toward concentrated end of method ratio range
- [x] Block 10 interaction conflict checks:
  - [x] Natural + light roast + mid-range grind + acidic → prefer temp increase over finer grind
  - [x] Very fresh (1–7 days) + fine grind + slow drain → open coarser + extend bloom instead
  - [x] Anaerobic + already low temp + bitter → go coarser, not colder
- [x] Recalculate Q-Air and Baratza equivalents via `grinder-converter.ts` after grind change
- [x] Recalculate pour step volumes when ratio changes
- [x] Return updated recipe JSON with `adjustment_applied` metadata (round, symptom, variable_changed, previous_value, new_value, direction, note)
- [x] Enforce max 3 feedback rounds (reject or surface nudge on round > 3)

---

## 4. Adjust Recipe API Route (`POST /api/adjust-recipe`)

- [x] Create `src/app/api/adjust-recipe/route.ts`
- [x] Accept `{ current_recipe, symptom, round }` — validate via Zod
- [x] Call adjustment engine and return updated recipe JSON with `adjustment_applied`
- [x] Return 400 on invalid symptom or round > 3

---

## 5. Feedback UI on Recipe Screen (`/recipe`)

- [x] "How did it taste?" button below the recipe card
- [x] Symptom selector: 5 single-select tappable cards (☀️ Too acidic / 🔥 Too bitter / 💧 Flat / 🐌 Slow drain / 💨 Fast drain)
- [x] "Adjust" button — triggers `/api/adjust-recipe` call
- [x] Round counter display: "Adjustment 1 of 3"
- [x] "Reset to Original" button — reverts recipe to the first generated version
- [x] After round 3: show method-switch nudge card ("This bean might work better with a different method") with link back to `/methods` with bean data pre-filled

---

## 6. Diff Rendering on Recipe Card

- [x] Highlight changed fields visually (amber background + ring on param cards, grinder block)
- [x] Inline annotation per changed value: "82 → 80 clicks (finer)"
- [x] Ensure unchanged fields render normally

---

## 7. sessionStorage Updates

- [x] Store original recipe separately so "Reset to Original" always has the baseline (`recipe_original`)
- [x] Store current feedback round count (`feedback_round`)
- [x] Persist `adjustment_applied` history (up to 3 entries) for round counter and nudge logic (`adjustment_history`)

---

## 8. Types (`src/types/recipe.ts`)

- [x] Add `adjustment_applied` field to `Recipe` (optional, via `RecipeWithAdjustment`)
- [x] Add `AdjustmentMetadata` type: `{ round, symptom, variable_changed, previous_value, new_value, direction, note }`
- [x] Add `FeedbackRound` history array type if needed for multi-round tracking

---

## Acceptance Criteria Checklist

- [x] User can select exactly one symptom per feedback round
- [x] Each adjustment changes only one variable (Block 9)
- [x] All adjustments stay within `final_operating_range` (grind) and offset-adjusted bounds (temp, ratio)
- [x] Block 10 interaction conflicts are detected and handled
- [x] Changed values are highlighted with previous → new annotation
- [x] Maximum 3 rounds; after round 3, method-switch nudge appears
- [x] "Reset to Original" reverts all adjustments cleanly
- [x] Grinder conversions (Q-Air, Baratza) update correctly after each grind adjustment
- [x] Pour step volumes recalculate when ratio changes
- [x] Manual entry with only process + roast level produces valid method recommendations
- [x] Manual entry with full data produces equivalent quality to image flow
- [x] Missing fields are noted as assumptions in `range_logic`
