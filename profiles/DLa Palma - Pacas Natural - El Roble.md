---
coffee:
  brand: "D'La Palma Café"
  variety: "Pacas"
  process: "Natural"
  farm: "El Roble"
  producer: "Saúl Gutierrez"
  origin: "La Palma, Chalatenango, El Salvador"
  elevation: "1800 msnm"
  roast_level: "Unknown — roast field blank"
  weight_options:
    - "200 g"
    - "400 g"
  format: "Ground or whole bean options; selection not visible"
source_image: "bags/pacas-natural.jpg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/el-salvador
  - coffee/pacas
  - coffee/natural
  - ocr/reference
---

# D'La Palma — Pacas Natural — El Roble

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | D'La Palma Café |
| Variety | Pacas |
| Process | Natural |
| Farm | El Roble |
| Producer | Saúl Gutierrez |
| Origin | La Palma, Chalatenango, El Salvador, C.A. |
| Elevation | 1800 msnm |
| Roast level | Blank / not supplied |
| Format options | Molido / Grano |
| Weight options | 200 g / 400 g |
| Roast date | Blank / not supplied |

### Tasting Notes

> **Original:** Fragancia frutal, dulce. Notas a piña, frambuesa, avellana, naranja dulce, blue berry y toffee. Final cremoso.  
> **English:** Fruity, sweet fragrance; pineapple, raspberry, hazelnut, sweet orange, blueberry, and toffee; creamy finish.

The profile is sweet and fruit-forward with a creamy finish. Acidity is not explicitly characterized.

## Local OCR Snapshot

```json
{
  "process": "unknown",
  "roast_level": "unknown",
  "altitude_masl": 1800,
  "finca": "El Roble",
  "producer": "Saúl",
  "origin": "El Salvador",
  "tasting_notes": [
    "frambuesa",
    "blue berry",
    "piña",
    "naranja dulce",
    "naranja",
    "avellana",
    "toffee"
  ],
  "variety": "Pacas"
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | D'La Palma Café | Not extracted | Missing |
| Variety | Pacas | Pacas | Exact |
| Process | Natural | `unknown` | Missing |
| Farm | El Roble | El Roble | Exact |
| Producer | Saúl Gutierrez | Saúl | Partial / truncated |
| Origin | La Palma, Chalatenango, El Salvador | El Salvador | Partial |
| Elevation | 1800 msnm | 1800 | Exact |
| Roast level | Blank | `unknown` | Correct unknown |
| Core flavor notes | Six printed notes | All six, plus redundant `naranja` | Partial |
| Fragrance / finish | Fruity, sweet; creamy finish | Not retained | Missing nuance |
| Format / weights | Options printed | Not mapped | Unsupported / missing |

## OCR Gaps

- The curved orange `NATURAL` text is missed on the original image.
- Producer extraction stops at `Saúl` instead of `Saúl Gutierrez`.
- `naranja dulce` also creates a redundant standalone `naranja`.
- Origin loses `La Palma, Chalatenango`; fragrance and finish qualifiers are dropped.

