# Revised Method Decision Logic for Specialty Coffee Brewing

## Core Principle

Do **not** choose a brew method based only on bean metadata.

Method recommendation should be based on 3 layers:

1. **Bean profile**  
   Process, roast level, variety, tasting notes, and freshness

2. **Desired cup outcome**  
   What the user wants most:
   - clarity
   - sweetness
   - body
   - lower acidity
   - balance
   - easiest / most forgiving brew

3. **Method behavior**  
   What each brewer naturally tends to emphasize:
   - clarity
   - body
   - sweetness
   - texture
   - forgiveness
   - acidity control
   - recipe flexibility

This is stronger than the original because it avoids pretending that a coffee has only one “correct” method. The original version leaned too hard on deterministic bean-to-method mapping.

---

# Supported Methods

| ID | Display Name |
|---|---|
| `v60` | Hario V60 |
| `origami` | Origami Air M |
| `orea_v4` | Orea V4 |
| `hario_switch` | Hario Switch |
| `kalita_wave` | Kalita Wave |
| `chemex` | Chemex |
| `ceado_hoop` | Ceado Hoop |
| `pulsar` | NextLevel Pulsar |
| `aeropress` | AeroPress |

---

# Method Behavior Profiles

These are the default tendencies of each brewer.

| Method | Clarity | Sweetness | Body | Acidity Emphasis | Forgiveness | Flexibility |
|---|---:|---:|---:|---:|---:|---:|
| `v60` | 5 | 3 | 2 | 5 | 2 | 3 |
| `origami` | 5 | 3 | 2 | 5 | 2 | 3 |
| `orea_v4` | 4 | 4 | 3 | 4 | 3 | 3 |
| `hario_switch` | 3 | 5 | 4 | 2 | 5 | 5 |
| `kalita_wave` | 3 | 4 | 4 | 2 | 4 | 3 |
| `chemex` | 4 | 3 | 2 | 3 | 3 | 2 |
| `ceado_hoop` | 2 | 4 | 4 | 1 | 5 | 2 |
| `pulsar` | 4 | 5 | 4 | 3 | 4 | 5 |
| `aeropress` | 2 | 4 | 5 | 1 | 5 | 5 |

### Practical interpretation
- **V60 / Origami**: best when the goal is brightness, transparency, floral expression, and clean structure.
- **Orea V4**: strong all-rounder when you want clarity plus sweetness.
- **Switch**: best when you want sweetness, roundness, lower sharpness, and a forgiving brew.
- **Kalita Wave**: balanced, sweet, stable, and easier than V60.
- **Chemex**: cleaner and lighter, but not always best for maximizing sweetness.
- **Ceado Hoop**: forgiving, rounded, low-sharpness cups.
- **Pulsar**: one of the most flexible brewers for maximizing sweetness and structure without losing too much clarity.
- **AeroPress**: great for body, low-acid presentation, and forgiving brewing.

---

# Inputs Required

```ts
type BrewDecisionInput = {
  process?: string
  roast_level?: string
  variety?: string
  tasting_notes?: string[]
  freshness_days_off_roast?: number
  desired_profile?: 'clarity' | 'sweetness' | 'body' | 'low_acidity' | 'balance' | 'forgiving'
  batch_size?: 'small' | 'medium' | 'large'
}
```

---

# Scoring Model

Each method starts at **0**.

Final score is the sum of:

1. **Desired Profile Weighting** -> strongest factor
2. **Process Compatibility**
3. **Roast Compatibility**
4. **Flavor Signal Compatibility**
5. **Variety / Delicacy Guidance** -> soft signal only
6. **Freshness Adjustment**
7. **Batch Size Adjustment**
8. **Penalty Rules** -> use sparingly

---

## 1. Desired Profile Scoring

This should be the most important layer.

| Desired Profile | Strong Match (+4) | Good Match (+2) |
|---|---|---|
| `clarity` | v60, origami, orea_v4 | chemex, pulsar |
| `sweetness` | hario_switch, pulsar, orea_v4 | kalita_wave, aeropress |
| `body` | aeropress, hario_switch, kalita_wave | pulsar, ceado_hoop |
| `low_acidity` | hario_switch, aeropress, ceado_hoop | kalita_wave, pulsar |
| `balance` | orea_v4, kalita_wave, hario_switch | pulsar, chemex |
| `forgiving` | hario_switch, aeropress, ceado_hoop | kalita_wave, pulsar |

### Why this change matters
Your original version made bean data the main driver. That is the biggest weakness. A washed Gesha can still reasonably go to V60, Switch, or Pulsar depending on whether the user wants clarity, sweetness, or softer acidity.

---

## 2. Process Compatibility

Use process as a **directional** signal, not a dictator.

| Process | Strong Match (+3) | Good Match (+1) | Light Penalty (-1) |
|---|---|---|---|
| Washed | v60, origami, orea_v4 | chemex, kalita_wave, pulsar | — |
| Natural | hario_switch, pulsar, kalita_wave | aeropress, orea_v4, ceado_hoop | — |
| Honey | hario_switch, kalita_wave, orea_v4 | pulsar, ceado_hoop, v60 | — |
| Anaerobic | pulsar, hario_switch, aeropress | kalita_wave, ceado_hoop, orea_v4 | v60 |
| Experimental / co-ferment | pulsar, hario_switch, aeropress | kalita_wave, ceado_hoop | v60, origami |

### Notes
- Washed coffees often benefit from cleaner brewers.
- Naturals and honeys often benefit from brewers that increase sweetness and roundness.
- Anaerobics should not be treated as automatically bad on V60, but V60 is often less forgiving if the fermentation character is aggressive.
- Origami should not be penalized as aggressively as in the original logic.

---

## 3. Roast Compatibility

Roast level should influence extraction style and cup softness.

| Roast | Strong Match (+3) | Good Match (+1) | Light Penalty (-1) |
|---|---|---|---|
| Light | v60, origami, orea_v4, pulsar | hario_switch, kalita_wave | — |
| Medium-Light | orea_v4, hario_switch, v60, kalita_wave | pulsar, origami | — |
| Medium | kalita_wave, hario_switch, orea_v4 | aeropress, pulsar, chemex | — |
| Medium-Dark | hario_switch, kalita_wave, aeropress | ceado_hoop, chemex | v60, origami |
| Dark | aeropress, ceado_hoop, hario_switch | kalita_wave, chemex | v60, origami, orea_v4 |

### Improvement over original
This version still respects roast behavior, but avoids overcommitting to clean brewers for coffees that will likely present too sharply or thinly there.

---

## 4. Flavor Signal Compatibility

Use tasting notes as supporting evidence, not as the sole truth.

| Flavor Family | Strong Match (+2) | Good Match (+1) |
|---|---|---|
| floral / jasmine / rose / tea-like | v60, origami, orea_v4 | chemex |
| citrus / bright / lemon / lime | v60, origami, orea_v4 | pulsar |
| stone fruit / berry / tropical | pulsar, hario_switch, orea_v4 | kalita_wave |
| chocolate / caramel / nutty / toffee | kalita_wave, aeropress, ceado_hoop | hario_switch, chemex |
| wine-like / layered / jammy | pulsar, hario_switch | aeropress, kalita_wave |
| spice / earthy / ferment-forward | aeropress, ceado_hoop, hario_switch | kalita_wave |

### Important rule
If multiple flavor families appear, score all relevant ones, but cap total flavor contribution to **+4 per method** so tasting notes do not dominate the model.

That fixes another issue in the original logic, where flavor keywords could push the model too hard toward a narrow result.

---

## 5. Variety / Delicacy Guidance

Treat variety as a **soft bias only**.

| Variety Type | Strong Match (+1) | Good Match (+0.5) |
|---|---|---|
| Gesha / Ethiopian landrace / very delicate exotic | v60, origami, orea_v4 | chemex, pulsar |
| Pacamara / SL28 / SL34 / expressive high-structure varieties | pulsar, orea_v4, hario_switch | v60, kalita_wave |
| Bourbon / Typica / Caturra / Catuai | kalita_wave, hario_switch, orea_v4 | chemex, v60 |
| Unknown | — | — |

### Why this is better
The original logic overvalued variety-to-method pairings. That is too rigid. Variety should gently shape the result, not dominate it. A Pacamara is not automatically a V60 coffee.

---

## 6. Freshness Adjustment

Freshness affects how aggressive or forgiving the method should be.

| Freshness | Adjustment |
|---|---|
| 4–10 days off roast | no change |
| 11–25 days | +1 to all methods with high clarity or high sweetness potential |
| 26+ days | +1 to hario_switch, pulsar, aeropress, kalita_wave |
| 0–3 days | -1 to v60, origami; +1 to hario_switch, kalita_wave |

### Why
Very fresh coffee can behave unevenly and sharply in highly exposed percolation brewers. More controlled brewers often produce a better cup early.

---

## 7. Batch Size Adjustment

Not every brewer scales equally well.

| Batch Size | Strong Match (+1) | Light Penalty (-1) |
|---|---|---|
| `small` (12–20 g dose) | v60, origami, aeropress, pulsar | chemex |
| `medium` (20–30 g dose) | orea_v4, hario_switch, kalita_wave, pulsar | — |
| `large` (30 g+ dose) | chemex, hario_switch, kalita_wave | aeropress |

---

## 8. Penalty Rules

Use these sparingly.

Apply **-1 only**, never heavy penalties, unless the pairing is genuinely poor.

Examples:
- Dark roast + V60 / Origami / Orea -> -1
- Extremely ferment-heavy coffee + V60 -> -1
- User wants low acidity + V60 / Origami -> -1
- User wants heavy body + Chemex -> -1

Do **not** penalize simply because a method is not the top theoretical match.

This fixes one of the original model’s main problems: penalties were too absolute.

---

# Ranking Rules

Return exactly 3 methods sorted by score descending.

Tie-break priority:
1. Better match to `desired_profile`
2. Higher forgiveness if user did not request clarity specifically
3. More versatility when bean data is incomplete

---

# Rationale Generation Rules

Each rationale should explain:
- what the method will do in the cup
- why it fits the bean profile
- why it matches the user’s desired outcome

Maximum 2 sentences.

Good rationale examples:
- “This method is the best fit if the goal is maximum clarity and floral definition from a washed light roast.”
- “This brewer should push sweetness and roundness while softening acidity, which suits this natural coffee well.”
- “This is the safest all-around option because it balances clarity, sweetness, and forgiveness.”

---

# Recommended Output Format

```json
{
  "recommendations": [
    {
      "method": "pulsar",
      "displayName": "NextLevel Pulsar",
      "rank": 1,
      "score": 14,
      "rationale": "Best choice if the goal is sweetness and layered fruit while keeping the cup structured. It suits expressive processed coffees especially well and is flexible enough to avoid excessive sharpness."
    },
    {
      "method": "hario_switch",
      "displayName": "Hario Switch",
      "rank": 2,
      "score": 12,
      "rationale": "This method increases sweetness and roundness while making the brew more forgiving. It is a strong fit when you want lower acidity and a more balanced presentation."
    },
    {
      "method": "orea_v4",
      "displayName": "Orea V4",
      "rank": 3,
      "score": 10,
      "rationale": "This is the best clean-cup alternative if you still want some clarity without losing too much sweetness. It works well for coffees with expressive fruit and medium-light roasts."
    }
  ]
}
```

---

# Final Decision Heuristics

## If data is incomplete
Use this order of importance:
1. desired_profile
2. roast_level
3. process
4. tasting_notes
5. variety

## If the user explicitly wants the “best method”
Interpret “best” as:
- the method most likely to produce the most impressive cup for that bean
- unless the user previously showed strong preference for sweetness, low acidity, or ease of brewing

## Default fallback logic
If bean info is weak or unknown:
1. `orea_v4`
2. `hario_switch`
3. `kalita_wave`

Those are safer defaults than hard defaulting to V60.

---

# Blunt Summary of What Changed

Compared with the original logic, this version:
- makes **desired cup profile** the top factor
- reduces overconfidence around **variety**
- removes the weak **altitude/density shortcut**
- softens **penalties**
- treats brewers like **behavioral tools**, not fixed identities
- makes the engine more realistic for real-world specialty coffee brewing
