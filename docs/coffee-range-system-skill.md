# Coffee Range System Skill — Blocks 1–10

This document is injected verbatim into the LLM system prompt. Follow every rule exactly.

---

## Block 1 — Method Base Ranges (K-Ultra Clicks + Temperature)

These are the **starting ranges** before any offsets. All grind values are in 1Zpresso K-Ultra clicks.

| Method | Grind Range (K-Ultra clicks) | Temp Base (°C) |
|---|---|---|
| V60 (Hario V60 02 / Mugen) | 72–79 | 92–94 |
| Origami Air M | 72–79 | 92–94 |
| Orea V4 | 71–78 | 92–94 |
| Hario Switch 03 | 75–82 | 91–94 |
| Kalita Wave | 76–82 | 91–93 |
| Chemex | 78–84 | 92–94 |
| Ceado Hoop | 76–83 | 91–94 |
| NextLevel Pulsar | 73–80 | 91–94 |
| AeroPress (Original + XL) | 66–76 | 88–92 |

---

## Block 1B — Ratio Ranges Per Method

| Method | Ratio Range |
|---|---|
| V60 / Origami Air M / Orea V4 | 1:15–1:17 |
| Hario Switch 03 | 1:13–1:16 |
| Kalita Wave | 1:15–1:17 |
| Chemex | 1:15–1:17 |
| Ceado Hoop | 1:14–1:16 |
| NextLevel Pulsar | 1:14–1:16 |
| AeroPress | 1:11–1:16 |

Select ratio within range based on:
- Lighter roast / washed / high altitude → higher ratio end (more water, cleaner)
- Natural / dark / dense → lower ratio end (more concentrated, syrupy)
- Fresh (< 14 days) → toward higher ratio (more dilution)

---

## Block 2 — Process Offsets

Apply these offsets to the Block 1 base range. **This is the primary and largest offset.**

| Process | Grind Offset (clicks) | Temp Offset (°C) | Notes |
|---|---|---|---|
| Washed | −2 to −1 (finer) | 0 to +1 (hotter) | Clarity first; highlight brightness |
| Natural | +1 to +2 (coarser) | −1 to −2 (cooler) | Manage body; prevent jammy/overextracted |
| Honey | 0 to +1 (slightly coarser) | 0 to −1 | Between washed and natural |
| Anaerobic | +1 to +3 (coarser) | −2 to −3 (coolest) | Heavy body, ferment notes; needs restraint |

---

## Block 3 — Roast Level Offsets

Apply after Block 2.

| Roast Level | Grind Offset (clicks) | Temp Offset (°C) |
|---|---|---|
| Light | −2 to 0 (finer) | 0 to +1 (hotter) |
| Medium-Light | −1 to 0 | 0 |
| Medium | 0 (neutral) | 0 (neutral) |
| Medium-Dark | 0 to +1 (slightly coarser) | 0 to −1 |
| Dark | +1 to +3 (coarser) | −1 to −2 (cooler) |

---

## Block 4 — Freshness Offsets (Days Since Roast)

Calculate days since roast. Apply after Block 3.

| Days Since Roast | State | Grind Offset | Bloom | Notes |
|---|---|---|---|---|
| 0–6 | Very fresh (degassing) | +2 to +3 coarser | +15s extended bloom (60s total) | CO2 causes channeling; go coarser + long bloom |
| 7–21 | Optimal window | 0 (neutral) | 30–45s standard bloom | Best extraction window |
| 22–35 | Aging | −1 to −2 finer | 30s standard | Finer to compensate aging |
| 36–60 | Stale | −2 to −3 finer | +agitation mid-pour | Finer + agitate to extract remaining flavor |
| 60+ | Very stale | −3 to −4 finer | +agitation | Consider skipping; note in recipe |

**If roast date is unknown:** Assume optimal window (7–21 days). Note this assumption in `range_logic.freshness_offset`.

---

## Block 5 — Density Fine-Tune (Variety + Altitude)

Apply as micro-adjustments (±1–2 clicks max per factor) after Block 4.

### By Variety

| Variety Type | Density | Grind Offset |
|---|---|---|
| Gesha / Geisha / delicate exotic cultivars | Dense, tight extraction window | −1 click (finer) |
| Pacamara / Maragogipe (large-bean cultivars) | Large particle distribution | +1 click (coarser) |
| Bourbon / Typica / Caturra | Medium density | 0 (neutral) |
| Catimor / Robusta-hybrid | High density | +1 click (coarser) |
| Unknown | — | 0, skip Block 5 |

### By Altitude

| Altitude (masl) | Density | Grind Offset |
|---|---|---|
| 1800+ masl | Very high density | −1 click (finer) |
| 1400–1800 masl | High density | 0 to −1 |
| 1000–1400 masl | Medium | 0 (neutral) |
| Below 1000 masl | Low density | +1 click (coarser) |
| Unknown | — | 0, skip altitude sub-block |

**Alignment rule:** If variety and altitude point in the same direction, apply the offset **once at midpoint** (e.g., both say finer → apply −1, not −2). If they conflict, apply 0 (cancel out).

**If variety and altitude are both unknown:** Skip Block 5 entirely. Note in `range_logic.density_offset`: "Skipped — variety/altitude unknown."

---

## Block 5B — Accumulation Cap Rule

After applying all offsets (Blocks 2–5), calculate the **total range width** in clicks.

- If final range width > 10 clicks → **compress toward center**
  - Trim equal clicks from both ends toward center
  - Prioritize preserving process offset direction (Block 2) over density fine-tune
  - Document that compression occurred: `"compressed": true`
- If final range width ≤ 10 clicks → leave as-is: `"compressed": false`

**Starting point** is always the **midpoint** of the final operating range (after compression).

Example:
- Base: 78–84 (6 clicks wide)
- Process +3 → 81–87
- Roast −1 → 80–86
- Freshness 0 → 80–86
- Density +1 → 81–87 (6 clicks wide — within cap, no compression needed)

---

## Block 6 — Mandatory Decision Order

**Always follow this exact sequence.** Never skip steps.

1. Look up method base range (Block 1) → record as `base_range`
2. Apply process offset (Block 2) → record as `process_offset`
3. Apply roast offset (Block 3) → record as `roast_offset`
4. Apply freshness offset (Block 4) → record as `freshness_offset`
5. Apply density fine-tune (Block 5) → record as `density_offset`
6. Check accumulation cap (Block 5B) → compress if > 10 clicks; record `compressed`
7. Select ratio (Block 1B) → based on bean complexity and freshness
8. Apply pour technique (Block 8) → method-specific adjustments
9. Check interaction rules (Block 10) → handle conflicts

Record the full offset chain in `range_logic`.

---

## Block 8 — Pour Technique Per Method

| Method | Technique | Process Adjustment |
|---|---|---|
| V60 | Spiral pour, 4–5 pours | Natural: slower, circular; Washed: aggressive spiral |
| Origami Air M | Similar to V60, faster drain | Natural: reduce agitation |
| Orea V4 | Multiple small pours, flat bed | Naturals benefit from lower agitation |
| Hario Switch | Bloom closed, open at 1:00 | Natural: open earlier (0:45) for less body |
| Kalita Wave | Steady center pour, 3–4 pours | Natural: circular to even saturation |
| Chemex | Large pours, long draws | Naturals: reduce pour size per stage |
| Ceado Hoop | Single continuous slow pour | Works well across all processes |
| NextLevel Pulsar | Long bloom, pulsed pours | Natural: fewer pulses, less pressure |
| AeroPress | Inverted or standard, stir | Natural: shorter steep; Anaerobic: minimal stir |

---

## Block 10 — Conflict Interaction Rules

Handle these specific combinations:

| Combination | Risk | Resolution |
|---|---|---|
| Natural + Light roast | Opposing offsets (natural coarser, light finer) | Keep process priority, then center with Block 5B if needed |
| Washed + Dark roast | Opposing offsets (washed finer, dark coarser) | Keep process priority; avoid pushing too coarse late in chain |
| Very fresh + Finer tendency | Contradicts fresh offset (wants coarser) | Prioritize freshness (coarser); note in output |
| Anaerobic + Light roast | Heavy offsets both directions | Compress hard; prioritize anaerobic (coarser) |
| High altitude + Dark roast | Dense bean + dark roast conflict | Apply altitude finer offset first; cap dark-roast coarsening at +1 |

**General principle:** When two offsets strongly conflict, prioritize in this order:
1. Process (Block 2) — highest priority
2. Freshness (Block 4) — second
3. Roast (Block 3) — third
4. Density (Block 5) — lowest priority

---

## Block 11 — Profile Guardrails (Washed Floral Coffees)

Apply these guardrails after Block 10 when the coffee is clearly in the washed/floral profile:

- process is `washed`
- roast is `light` or `medium-light`
- altitude is `1300+ masl` (when known)
- notes include floral/citrus/tea-like fruit descriptors

Then:
- Bias the starting point to the **finer half** of the final operating range.
- Apply an extra **−1 click** micro-adjustment before midpoint selection.
- Do not let freshness coarsening exceed **+1 click** for this profile unless roast age is explicitly `< 4 days`.

This guardrail prevents systematic over-coarsening on delicate washed coffees where clarity and acidity are expected.
