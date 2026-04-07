# Output Format Specification

The LLM must output **only valid JSON** matching this schema. Zero extra text outside the JSON object.

---

## Full Recipe JSON Schema

```json
{
  "method": "string — method ID (e.g., 'v60', 'hario_switch')",
  "display_name": "string — human name (e.g., 'Hario V60')",
  "objective": "string — 1–2 sentence cup profile goal",
  "parameters": {
    "coffee_g": "integer — grams of coffee, ALWAYS a whole number (round to nearest integer)",
    "water_g": "number — total water in grams",
    "ratio": "string — e.g. '1:15'",
    "temperature_c": "number — brew water temperature in Celsius",
    "filter": "string — filter type and brand (e.g., 'Hario V60 02 tabbed paper')",
    "total_time": "string — e.g. '4:00 – 4:30'"
  },
  "grind": {
    "k_ultra": {
      "range": "string — e.g. '81–84 clicks'",
      "starting_point": "string — e.g. '83 clicks'",
      "description": "string — texture description (e.g., 'coarser than table salt, finer than raw sugar')"
    },
    "q_air": {
      "range": "string — e.g. '6.2–6.6 (on the 0–10 scale)'",
      "starting_point": "string — e.g. '6.4'"
    },
    "baratza_encore_esp": {
      "range": "string — e.g. 'clicks 18–21'",
      "starting_point": "string — e.g. '20 clicks'",
      "note": "string — precision note, e.g. 'Upper range of pour-over zone; step down one click if drain is very slow'"
    },
    "timemore_c2": {
      "range": "string — e.g. 'clicks 17–20'",
      "starting_point": "string — e.g. '18 clicks'",
      "note": "string — precision note, e.g. 'Adjust ±1 click based on drain speed.'"
    }
  },
  "range_logic": {
    "base_range": "string — e.g. '78–84 clicks (V60 base)'",
    "process_offset": "string — e.g. '+0 to −2 (washed: finer/hotter)'",
    "roast_offset": "string — e.g. '−1 to −2 (light roast: finer)'",
    "freshness_offset": "string — e.g. '0 (optimal window 7–21 days assumed)'",
    "density_offset": "string — e.g. '−1 (Gesha: low density, finer)' or 'Skipped — variety/altitude unknown'",
    "final_operating_range": "string — e.g. '75–81 clicks'",
    "compressed": "boolean — true if Block 5B compression was applied",
    "starting_point": "string — e.g. '78 clicks (midpoint of final range)'"
  },
  "steps": [
    {
      "step": "number — step number (1, 2, 3...)",
      "time": "string — e.g. '0:00'",
      "action": "string — what to do",
      "water_poured_g": "number — water added in this step (0 if no water)",
      "water_accumulated_g": "number — total water at end of this step"
    }
  ],
  "quick_adjustments": {
    "too_acidic": "string — grind coarser or brew hotter",
    "too_bitter": "string — grind finer or brew cooler",
    "flat_or_lifeless": "string — adjust agitation, ratio, or temp",
    "slow_drain": "string — grind coarser",
    "fast_drain": "string — grind finer or check tamp/distribution"
  }
}
```

---

## Hard Constraints

1. `coffee_g × ratio_number ≈ water_g` (within ±5 g)
2. `sum(steps[].water_poured_g) = water_g` (exact match; bloom water counts)
3. K-Ultra `starting_point` must be within `final_operating_range`
4. Temperature must be within the offset-adjusted temp range
5. Ratio must be within the method's range from Block 1B
6. Final grind range width ≤ 10 K-Ultra clicks (Block 5B)
7. All 3 grinders must be present and non-null
8. All 5 quick adjustment keys must be present and non-empty
9. `range_logic` must have all 6 fields (base_range, process_offset, roast_offset, freshness_offset, density_offset, final_operating_range)
10. Baratza Encore ESP starting_point must be in clicks 14–24 for all pour-over methods (V60, Origami, Orea V4, Hario Switch, Kalita Wave, Chemex, Ceado Hoop, Pulsar)
11. AeroPress Baratza range may go below 14 (finer range acceptable)
12. Steps must be numbered sequentially starting at 1
13. First step should be pre-infusion / bloom (except AeroPress press step)
14. `water_accumulated_g` in last step must equal `water_g`

---

## Example Output

```json
{
  "method": "v60",
  "display_name": "Hario V60",
  "objective": "A clean, bright cup that highlights the floral and citrus notes of this washed light roast Ethiopian.",
  "parameters": {
    "coffee_g": 15,
    "water_g": 250,
    "ratio": "1:16.7",
    "temperature_c": 94,
    "filter": "Hario V60 02 tabbed paper",
    "total_time": "3:30 – 4:00"
  },
  "grind": {
    "k_ultra": {
      "range": "76–80 clicks",
      "starting_point": "78 clicks",
      "description": "Medium-fine, slightly coarser than table salt"
    },
    "q_air": {
      "range": "5.8–6.2",
      "starting_point": "6.0"
    },
    "baratza_encore_esp": {
      "range": "clicks 17–20",
      "starting_point": "18 clicks",
      "note": "Mid pour-over zone; adjust by ±1 click based on drain speed"
    },
    "timemore_c2": {
      "range": "clicks 17–20",
      "starting_point": "18 clicks",
      "note": "Adjust ±1 click based on drain speed."
    }
  },
  "range_logic": {
    "base_range": "78–84 clicks (V60 base)",
    "process_offset": "−2 (washed: finer for clarity)",
    "roast_offset": "−2 (light roast: finer/hotter)",
    "freshness_offset": "0 (optimal window assumed)",
    "density_offset": "−1 (Gesha low density fine-tune)",
    "final_operating_range": "73–79 clicks (7 clicks wide — within 10-click cap)",
    "compressed": false,
    "starting_point": "76 clicks (midpoint)"
  },
  "steps": [
    { "step": 1, "time": "0:00", "action": "Bloom — pour 45g in concentric circles. Wait 40 seconds.", "water_poured_g": 45, "water_accumulated_g": 45 },
    { "step": 2, "time": "0:40", "action": "First pour — slowly spiral to 150g.", "water_poured_g": 105, "water_accumulated_g": 150 },
    { "step": 3, "time": "1:30", "action": "Second pour — spiral to 200g.", "water_poured_g": 50, "water_accumulated_g": 200 },
    { "step": 4, "time": "2:20", "action": "Final pour — center pour to 250g. Target drawdown complete by 3:30–4:00.", "water_poured_g": 50, "water_accumulated_g": 250 }
  ],
  "quick_adjustments": {
    "too_acidic": "Grind 2 clicks coarser (to ~80 clicks) or raise temp to 95°C.",
    "too_bitter": "Grind 2 clicks finer (to ~76 clicks) or lower temp to 92°C.",
    "flat_or_lifeless": "Add gentle swirl after final pour, or increase agitation during first pour.",
    "slow_drain": "Grind 1–2 clicks coarser. Check paper is fully rinsed.",
    "fast_drain": "Grind 1–2 clicks finer, or pour more slowly."
  }
}
```
