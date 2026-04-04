# Phase 1 — Image-First Bean Extraction + Method Recommendation + Recipe Generation

## Goal

Deliver the primary loop: user uploads a photo of their specialty coffee bag, the system extracts bean metadata, recommends the top 3 brewing methods using the **method decision logic**, user picks one, and the app generates a structured recipe using the **coffee range system** (dynamic ranges, offsets, grinder-specific settings).

---

## Scope

### In Scope

- Mobile-first image upload (camera or gallery)
- Vision model extraction of bean metadata from bag photo
- Editable confirmation step (user reviews/corrects extracted data)
- **Method decision logic** that maps bean profile → top 3 recommended methods
- Method selection UI (user picks one of the three)
- **Coffee range system**: range-based recipe generation (base ranges → offsets → final operating range)
- LLM generates recipe as strict JSON, enforcing the **output format** spec
- **Grinder-specific recommendations** for all 3 grinders (K-Ultra, Q-Air, Baratza Encore ESP)
- Frontend recipe rendering from JSON using styled UI components
- `POST /api/extract-bean` endpoint
- `POST /api/generate-recipe` endpoint
- Schema validation with retry on malformed output

### Out of Scope

- Manual bean entry (fallback for Phase 2)
- Post-brew feedback / recipe adjustments (Phase 2)
- User accounts, persistence, or saved recipes (Phase 3)

---

## User Flow

```
┌─────────────────────────┐
│  Upload coffee bag photo │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Vision model extracts: │
│  variety, process,      │
│  origin, altitude,      │
│  roast, tasting notes   │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  User reviews/edits     │
│  extracted bean info    │
│  + enters roast date    │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Method decision logic  │
│  scores bean profile →  │
│  top 3 methods          │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  User picks a method    │
└────────────┬────────────┘
             ▼
┌─────────────────────────────────┐
│  Coffee Range System builds     │
│  recipe via offset chain:       │
│  method base → process offset   │
│  → roast offset → freshness    │
│  offset → variety/density fine  │
│  tune → final operating range  │
└────────────┬────────────────────┘
             ▼
┌─────────────────────────┐
│  LLM generates strict   │
│  JSON recipe per output  │
│  format spec             │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Frontend renders        │
│  styled recipe card      │
└─────────────────────────┘
```

---

## Bean Extraction — What the Vision Model Must Return

The vision model extracts everything the range system needs as inputs:

| Field | Required | Source | Used by |
|---|---|---|---|
| `variety` | Preferred | Bag label (e.g., Gesha, Pacamara, Bourbon) | Method logic + density offset (Block 5) |
| `process` | **Yes** | Bag label (washed, natural, honey, anaerobic) | Method logic + main offset (Block 2) |
| `origin` | Preferred | Bag label (country, region) | Method logic context |
| `altitude` | Nice to have | Bag label (masl) | Density offset (Block 5) |
| `roast_level` | **Yes** | Bag label or inferred from color/description | Roast offset (Block 3) |
| `tasting_notes` | Preferred | Bag label | Method logic (delicate vs complex vs bold) |
| `roaster` | Nice to have | Bag label | Display only |
| `bean_name` | Nice to have | Bag label | Display only |

**User-provided (not extracted):**

| Field | Required | Notes |
|---|---|---|
| `roast_date` | Preferred | User enters manually; drives freshness offset (Block 4) |

If `roast_date` is missing, the system assumes **optimal window (8–21 days)** and notes this in the recipe.

If `variety` or `altitude` are missing, the system skips the density fine-tune (Block 5) and notes the assumption.

---

## Method Decision Logic (from `method-decision-logic.md`)

This is **deterministic** — no LLM involved. The rule engine scores methods against the bean profile.

### Decision matrix

| Bean Profile | Top Methods | Rationale |
|---|---|---|
| Delicate / floral (e.g., Gesha, high-altitude washed) | V60, Origami, Orea V4 | Maximum clarity to highlight florals |
| Complex / processed (natural, honey, anaerobic) | Hario Switch, Pulsar, Kalita Wave | Control body and sweetness; structure for naturals |
| Body + balanced sweetness | Hario Switch, Kalita Wave, Chemex | Clean body with sweetness |
| Dense / hard to extract (Pacamara, light roast, high altitude) | Pulsar, AeroPress, Ceado Hoop | High extraction energy needed |

### Supported methods (MVP — full equipment list)

- Hario V60 (02 / Mugen)
- Hario Switch 03
- Chemex
- Kalita Wave
- Origami Air M
- AeroPress (Original + XL)
- NextLevel Pulsar
- Orea V4
- Ceado Hoop

### Output

```json
{
  "recommendations": [
    {
      "method": "Hario Switch",
      "rank": 1,
      "rationale": "Hybrid immersion controls body and sweetness — ideal for this natural process."
    },
    {
      "method": "Kalita Wave",
      "rank": 2,
      "rationale": "Flat bed gives structure and even extraction for fruit-forward naturals."
    },
    {
      "method": "V60",
      "rank": 3,
      "rationale": "Maximum clarity on the floral notes, at the cost of some body."
    }
  ]
}
```

---

## Coffee Range System — Recipe Generation Logic

The LLM receives the full range system as context and must follow the **mandatory decision order** (Block 6):

### Offset chain (executed in strict order)

| Step | Source block | What happens |
|---|---|---|
| 1. Method base range | Block 1 | K-Ultra clicks + temp base for selected method |
| 2. Process offset | Block 2 | Primary shift — washed: finer/hotter · natural: coarser/cooler · anaerobic: coarser/coolest |
| 3. Roast offset | Block 3 | Light: finer/hotter · medium: neutral · dark: coarser/cooler |
| 4. Freshness offset | Block 4 | From `roast_date` vs today — very fresh: coarser + longer bloom · old: finer/hotter + agitation |
| 5. Density fine-tune | Block 5 | Variety + altitude micro-adjust (±1–2 clicks). When aligned, apply once at midpoint |
| 6. Accumulation cap | Block 5B | Final range must not exceed **10 clicks width**. If wider → compress toward center, prioritizing process + roast |
| 7. Ratio selection | Block 1B | Pick within method's ratio range; adjust by bean complexity/freshness |
| 8. Pour technique | Block 8 | Method-specific pour style, adjusted by process |
| 9. Interaction rules | Block 10 | Handle conflicting combos (natural + light, washed + dark, fresh + fine, anaerobic + light) |

### Key reference tables injected into the LLM prompt

**Method base ranges (K-Ultra, Block 1):**

| Method | Grind range (clicks) | Temp base |
|---|---|---|
| V60 / Origami | 78–84 | 92–94°C |
| Orea V4 | 76–83 | 92–94°C |
| Hario Switch | 80–86 | 91–94°C |
| Kalita Wave | 80–86 | 91–93°C |
| Chemex | 82–88 | 92–94°C |
| Ceado Hoop | 80–87 | 91–94°C |
| Pulsar | 78–85 | 91–94°C |
| AeroPress | 70–80 | 88–92°C |

**Ratio ranges (Block 1B):**

| Method | Ratio range |
|---|---|
| V60 / Origami / Orea V4 | 1:15–1:17 |
| Hario Switch | 1:13–1:16 |
| Kalita Wave | 1:15–1:17 |
| Chemex | 1:15–1:17 |
| Ceado Hoop | 1:14–1:16 |
| Pulsar | 1:14–1:16 |
| AeroPress | 1:11–1:16 |

---

## Grinder Conversion — All Three Grinders in Every Recipe

Every recipe must include settings for all 3 grinders. K-Ultra is the primary reference; Q-Air and Baratza Encore ESP are converted via shared micron scale.

### Conversion approach

1. Calculate K-Ultra click recommendation (from range system)
2. Map to approximate micron value using K-Ultra grind table
3. Find equivalent setting on Q-Air and Baratza Encore ESP using their respective tables

### Baratza Encore ESP constraint

For pour-over methods, the useful range is **clicks 14–24**. The LLM must stay within this zone and note reduced precision at the coarse end.

### Grinder tables (injected into LLM prompt)

- `1zpresso-k-ultra-grind-table.md`
- `1zpresso-q-air-grind-table.md`
- `baratza-encore-esp-grind-table.md`

---

## LLM Prompt Structure

```
SYSTEM PROMPT:
1. Role definition — advanced barista-level recipe generator
2. Full coffee-range-system-skill.md (Blocks 1–10)
3. method-decision-logic.md (context on why the method was chosen)
4. output-format.md (strict recipe structure)
5. All 3 grinder tables (conversion reference)
6. Hard constraints:
   - Follow mandatory decision order (Block 6)
   - Respect accumulation cap (Block 5B)
   - Output ONLY valid JSON matching recipe schema
   - Zero extra text outside JSON
   - Include all 3 grinders
   - Steps must have time, water poured, water accumulated
   - Include all 5 quick adjustment categories
   - Show offset chain in range_logic field

USER PROMPT:
{
  "method": "hario_switch",
  "bean": { ...extracted + user-provided fields... }
}
```

---

## Recipe JSON Schema

```json
{
  "method": "string",
  "objective": "string — cup profile goal",
  "parameters": {
    "coffee_g": "number",
    "water_g": "number",
    "ratio": "string (e.g., 1:15)",
    "temperature_c": "number",
    "filter": "string",
    "total_time": "string (e.g., 4:00 – 5:00)"
  },
  "grind": {
    "k_ultra": {
      "range": "string",
      "starting_point": "string",
      "description": "string"
    },
    "q_air": {
      "range": "string",
      "starting_point": "string"
    },
    "baratza_encore_esp": {
      "range": "string",
      "starting_point": "string",
      "note": "string (precision note)"
    }
  },
  "range_logic": {
    "base_range": "string",
    "process_offset": "string",
    "roast_offset": "string",
    "freshness_offset": "string",
    "density_offset": "string",
    "final_operating_range": "string",
    "compressed": "boolean",
    "starting_point": "string"
  },
  "steps": [
    {
      "time": "string",
      "action": "string",
      "water_poured_g": "number",
      "water_accumulated_g": "number"
    }
  ],
  "quick_adjustments": {
    "too_acidic": "string",
    "too_bitter": "string",
    "flat_or_lifeless": "string",
    "slow_drain": "string",
    "fast_drain": "string"
  }
}
```

### Post-LLM validation rules

| Check | Rule |
|---|---|
| `coffee_g × ratio ≈ water_g` | Within ±5 g |
| `sum(steps[].water_poured_g) = water_g` | Exact match |
| K-Ultra clicks within valid offset-adjusted range | Cross-check against range_logic |
| Temperature within valid offset-adjusted range | Cross-check against range_logic |
| Ratio within method's range (Block 1B) | Must match |
| Final range width ≤ 10 clicks | Block 5B accumulation cap |
| All 3 grinders present and non-null | Required |
| All 5 quick adjustment keys present | Required |
| `range_logic` complete (all offset fields) | Required for transparency |
| Baratza Encore ESP in 14–24 zone for pour-over | Method-specific check |

---

## Recipe Card — UI Rendering

The frontend maps JSON fields to styled UI components — **not** markdown or raw text.

| JSON field | UI element |
|---|---|
| `method` | Header with method icon/illustration |
| `objective` | Subheader — cup profile description |
| `parameters.coffee_g` / `water_g` | Large ratio display (e.g., "15g → 225g") |
| `parameters.ratio` | Badge (e.g., "1:15") |
| `parameters.temperature_c` | Temperature badge with thermometer icon |
| `parameters.filter` | Small label |
| `parameters.total_time` | Timer-style display |
| `grind.k_ultra` | Primary grind card (range + starting point + description) |
| `grind.q_air` | Secondary grind row |
| `grind.baratza_encore_esp` | Secondary grind row (with precision note) |
| `steps[]` | Numbered step cards: time · action · water poured · accumulated |
| `quick_adjustments` | Collapsible section with 5 adjustment tips |
| `range_logic` | Hidden by default; expandable "How was this calculated?" for transparency |

---

## Deliverables

1. **Upload screen** — single CTA, camera/gallery, client-side compression
2. **Bean confirmation card** — editable fields + roast date input + confidence indicators
3. **Method recommendation cards** — 3 tappable options with rationale
4. **Recipe card component** — full UI rendering from JSON
5. **`POST /api/extract-bean`** — vision model + schema validation
6. **`POST /api/generate-recipe`** — range system prompt + LLM + validation + retry
7. **Method decision engine** — deterministic scoring (from `method-decision-logic.md`)
8. **LLM prompt template** — assembled from range system + grinder tables + output format
9. **Grinder conversion logic** — K-Ultra → Q-Air + Baratza via micron mapping
10. **Validation module** — schema + realism + accumulation cap + retry

---

## Acceptance Criteria

- [ ] User can upload a coffee bag photo and see extracted bean data within 5 seconds
- [ ] Extraction captures variety, process, origin, altitude, roast level, and tasting notes
- [ ] Low-confidence fields (< 0.6) are visually flagged
- [ ] User can enter roast date manually
- [ ] Method recommendation follows the decision logic matrix
- [ ] Exactly 3 methods recommended, ranked with rationale
- [ ] Recipe follows **mandatory decision order** (Block 6)
- [ ] Recipe includes grind settings for all 3 grinders
- [ ] Baratza Encore ESP stays within clicks 14–24 for pour-over
- [ ] Final operating range ≤ 10 clicks width (Block 5B)
- [ ] Steps include time, water poured, and water accumulated
- [ ] All 5 quick adjustment categories present
- [ ] Ratio within method's range (Block 1B)
- [ ] Temperature and grind within offset-adjusted bounds
- [ ] `range_logic` shows the full offset chain
- [ ] Recipe JSON passes schema validation ≥ 95% of the time
- [ ] Recipe card renders as styled UI (not raw text)
- [ ] Full flow (upload → recipe) completes in < 15 seconds on 4G

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vision model misreads bag | Editable confirmation; per-field confidence |
| LLM ignores offset chain | Full range system in prompt; validate offset math post-generation; retry with error |
| Grinder conversion inaccuracy | Micron-based mapping from tables; validate against table ranges |
| Accumulation cap violated | Post-check: range > 10 → reject + retry with compression instruction |
| Missing variety/altitude | Skip Block 5; note assumption in `range_logic` |
| Missing roast date | Default to optimal (8–21 days); note assumption |
| Conflicting interactions (Block 10) | Rules in prompt; validate LLM doesn't go to extremes |

---

## Estimated Effort

| Task | Estimate |
|---|---|
| Image upload UI + compression | 1–2 days |
| `/api/extract-bean` + vision prompt | 2–3 days |
| Bean confirmation + roast date input | 1–2 days |
| Method decision engine | 2–3 days |
| Method selector UI | 1 day |
| LLM prompt assembly (range system + tables + format) | 2–3 days |
| `/api/generate-recipe` + validation + retry | 2–3 days |
| Recipe card UI (all sections) | 3–4 days |
| Grinder conversion logic | 1–2 days |
| Integration + mobile testing | 2–3 days |
| **Total** | **~17–24 days** |
