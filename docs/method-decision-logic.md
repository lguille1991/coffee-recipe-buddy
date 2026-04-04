# Method Decision Logic

This document defines the deterministic scoring algorithm used by `method-decision-engine.ts` to recommend the top 3 brewing methods for a given bean profile.

---

## Supported Methods

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

## Scoring Algorithm

Each method starts at 0 points. Apply all scoring rules below. Return the top 3 methods by score.

### 1. Process Scoring

| Process | Best Methods (+3) | Good Methods (+1) | Avoid (−2) |
|---|---|---|---|
| Washed | v60, origami, orea_v4 | kalita_wave, chemex | — |
| Natural | hario_switch, pulsar, kalita_wave | ceado_hoop, aeropress | — |
| Honey | hario_switch, kalita_wave, ceado_hoop | v60, origami | — |
| Anaerobic | pulsar, aeropress, hario_switch | ceado_hoop | v60, origami |

### 2. Roast Level Scoring

| Roast | Best Methods (+2) | Good Methods (+1) | Avoid (−1) |
|---|---|---|---|
| Light | v60, origami, orea_v4, pulsar | kalita_wave | — |
| Medium-Light | v60, origami, orea_v4, hario_switch | kalita_wave, ceado_hoop | — |
| Medium | kalita_wave, hario_switch, chemex | all others +0 | — |
| Medium-Dark | kalita_wave, chemex, hario_switch | ceado_hoop | v60, origami |
| Dark | aeropress, chemex, ceado_hoop | kalita_wave | v60, origami, orea_v4 |

### 3. Variety / Delicacy Scoring

| Variety Type | Best Methods (+2) | Good Methods (+1) |
|---|---|---|
| Gesha, Pacamara, exotic | v60, origami, orea_v4 | pulsar |
| Bourbon, Typica, Caturra | kalita_wave, hario_switch, chemex | v60 |
| High-grown / specialty (generic) | v60, origami | orea_v4, pulsar |
| Unknown / other | — (no bonus) | — |

### 4. Flavor Profile Scoring (from tasting_notes)

Score based on descriptors in tasting notes:

| Descriptor Keywords | Matching Methods (+2) |
|---|---|
| floral, jasmine, rose, lavender | v60, origami, orea_v4 |
| fruity, berry, tropical, stone fruit | hario_switch, pulsar, kalita_wave |
| chocolate, nutty, caramel, toffee | chemex, kalita_wave, ceado_hoop |
| citrus, bright, lemon, lime | v60, origami, orea_v4 |
| earthy, tobacco, spice, ferment | aeropress, ceado_hoop, hario_switch |
| complex, layered, wine-like | pulsar, hario_switch |
| clean, crisp, tea-like | v60, origami |

### 5. Altitude / Density Scoring

| Altitude | Dense Bean Methods (+1) |
|---|---|
| 1800+ masl | pulsar, aeropress (+1 for high-energy extraction) |
| Below 1000 masl | ceado_hoop, kalita_wave (+1 for gentle methods) |
| Unknown | no change |

---

## Output Format

Return exactly 3 methods, sorted by score descending. Include rationale string for each.

```json
{
  "recommendations": [
    {
      "method": "v60",
      "displayName": "Hario V60",
      "rank": 1,
      "score": 12,
      "rationale": "Maximum clarity to highlight the floral and citrus notes of this washed light roast."
    },
    {
      "method": "origami",
      "displayName": "Origami Air M",
      "rank": 2,
      "score": 10,
      "rationale": "Similar clarity to V60 with faster drain, excellent for delicate washed coffees."
    },
    {
      "method": "orea_v4",
      "displayName": "Orea V4",
      "rank": 3,
      "score": 9,
      "rationale": "Flat-bottom even extraction accentuates brightness and sweetness."
    }
  ]
}
```

## Rationale Generation Rules

Rationale must mention at least one of:
- Why the method suits this **process**
- Why it suits this **roast level** or **flavor profile**
- What the method **does** for the cup (clarity, body, structure, sweetness, etc.)

Max 2 sentences. Plain English. No jargon the user wouldn't understand.
