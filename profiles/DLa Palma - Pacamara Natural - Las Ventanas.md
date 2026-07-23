---
coffee:
  brand: "D'La Palma Café"
  variety: "Pacamara"
  process: "Natural"
  farm: "Las Ventanas"
  producer: "Yobani Ochoa"
  origin: "La Palma, Chalatenango, El Salvador"
  elevation: "1450 msnm"
  roast_level: "Unknown — roast field blank"
  weight_options:
    - "200 g"
    - "400 g"
  format: "Ground or whole bean options; selection not visible"
source_image: "bags/pacamara-natural.jpg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/el-salvador
  - coffee/pacamara
  - coffee/natural
  - ocr/reference
---

# D'La Palma — Pacamara Natural — Las Ventanas

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | D'La Palma Café |
| Variety | Pacamara |
| Process | Natural |
| Farm | Las Ventanas |
| Producer | Yobani Ochoa |
| Origin | La Palma, Chalatenango, El Salvador, C.A. |
| Elevation | 1450 msnm |
| Roast level | Blank / not supplied |
| Format options | Molido / Grano |
| Weight options | 200 g / 400 g |
| Roast date | Blank / not supplied |

### Tasting Notes

> **Original:** Fragancia dulce. Avellana, chocolate, cereza. Notas a naranja, ciruela, blueberry, cardamomo. Final cremoso.  
> **English:** Sweet fragrance; hazelnut, chocolate, cherry, orange, plum, blueberry, and cardamom; creamy finish.

The profile is sweet, fruit-forward, gently spiced, and creamy. Acidity is not explicitly characterized.

## Local OCR Snapshot

```json
{
  "process": "natural",
  "roast_level": "unknown",
  "producer": "Yobani Ochoa",
  "tasting_notes": [
    "Ciruela",
    "blueberry",
    "cardamomo",
    "avellana",
    "naranja",
    "cereza",
    "chocolate"
  ],
  "altitude_masl": 1450,
  "finca": "Las Ventanas",
  "variety": "Pacamara",
  "origin": "El Salvador"
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | D'La Palma Café | Not extracted | Missing |
| Variety | Pacamara | Pacamara | Exact |
| Process | Natural | natural | Exact |
| Farm | Las Ventanas | Las Ventanas | Exact |
| Producer | Yobani Ochoa | Yobani Ochoa | Exact |
| Origin | La Palma, Chalatenango, El Salvador | El Salvador | Partial |
| Elevation | 1450 msnm | 1450 | Exact |
| Roast level | Blank | `unknown` | Correct unknown |
| Core flavor notes | Seven printed flavor notes | Same seven notes | Exact |
| Fragrance / finish | Sweet fragrance; creamy finish | Not retained | Missing nuance |
| Format / weights | Options printed | Not mapped | Unsupported / missing |

## OCR Gaps

- Core Analysis mapping is correct.
- Origin loses `La Palma, Chalatenango`.
- The structured flavor list drops the sweet-fragrance and creamy-finish qualifiers.
- Brand, format, and weight options are not represented.

